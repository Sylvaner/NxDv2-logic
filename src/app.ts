import { Plugin } from './plugins/plugin';
import { StoreService } from './services/StoreService';
import { StateService } from './services/StateService';
import { MqttService, MqttConfig } from './services/MqttService';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { DbCredentials } from './services/DbService';

/**
 * Subscribe topics for each plugins
 *
 * @param plugins Loaded plugins
 */
function subscribePluginsTopics(plugins: Map<string, Plugin>): void {
  // List of all topics to subscribe
  const topicsToSubscribe: string[] = [];

  plugins.forEach((translator) => {
    topicsToSubscribe.push(...translator.getTopicsToSubscribe());
    for (const topicPrefix of translator.getTopicsPrefixs()) {
      messageParsers.set(topicPrefix, translator);
    }
  });
  mqttConnector.subscribe(topicsToSubscribe, mqttMessageParser);
}

/**
 * Send message from topic to the good plugins
 *
 * @param topic Source topic
 * @param message Message received
 */
function mqttMessageParser(topic: string, message: Buffer): void {
  // Recherche du plugin concerné
  // TODO: Trouver une méthode qui évite un parcours à chaque fois
  messageParsers.forEach((plugin, topicPrefix) => {
    if (topic.indexOf(topicPrefix) !== -1) {
      plugin.messageHandler(topic, message);
    }
  });
}

/**
 * Load all enabled plugins
 *
 * @returns List of plugin instances
 */
function initPlugins(): Map<string, Plugin> {
  const plugins = new Map<string, Plugin>();
  enabledPlugins.forEach((pluginName) => {
    import(__dirname + '/plugins/' + pluginName).then((importedModule) => {
      const pluginInstance: Plugin = new importedModule[pluginName]();
      console.log('Loading plugin ' + pluginInstance.getName());
      plugins.set(pluginInstance.getName(), pluginInstance);
    }).catch((err) => {
      console.error('Error on loading plugin ' + pluginName);
      console.error(err);
    });
  });
  return plugins;
}

/**
 * Read configuration file
 * Priority:
 *  - .env
 *  - ../.env
 *  - /etc/nextdom/nextdom.conf
 */
function readConfigFile(): boolean {
  if (fs.existsSync(`${__dirname}/.env`)) {
    dotenv.config({ path: `${__dirname}/.env` });
    return true;
  } else if (fs.existsSync(`${__dirname}/../.env`)) {
    dotenv.config({ path: `${__dirname}/../.env` });
    return true;
  } else if (fs.existsSync('/etc/nextdom/nextdom.conf')) {
    dotenv.config({ path: '/etc/nextdom/nextdom.conf' });
    return true;
  }
  return false;
}

/**
 * Connect to database and start daemon
 */
function start(): void {
  const storeCredentials: DbCredentials = {
    host: process.env.DB_HOST!,
    database: process.env.DB_DATABASE!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  };

  const stateCredentials: DbCredentials = {
    host: process.env.DB_HOST!,
    database: process.env.DB_STATE_DATABASE!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  };

  const storeObjectsCollections = [
    'devices',
    'zones'
  ];

  const stateObjectsCollections = [
    'states'
  ];

  // Connect to all databases, start plugin and connect to mqtt
  StoreService.getInstance().connect(storeCredentials, storeObjectsCollections).then(() => {
    StateService.getInstance().connect(stateCredentials, stateObjectsCollections).then(() => {
      const plugins = initPlugins();
      connectToMqtt(plugins);
    });
  });
}

/**
 * Connect to Mqtt and start reconnect loop on disconnect
 * 
 * @param plugins List of plugins
 */
function connectToMqtt(plugins: Map<string, Plugin>) {
  mqttConnector.connect(
  // Connection callback
  () => {
    subscribePluginsTopics(plugins);
  }, 
  // Disconnection callback
  () => {
    setTimeout(() => {
      // Retry connection
      connectToMqtt(plugins);
    }, 5000);
  });
}

// List of plugins
const enabledPlugins = ['Homie', 'HomeAssistant'];

if (!readConfigFile()) {
  console.error('Unable to read config file.');
  process.exit(1);
}

const mqttConfig: MqttConfig = {
  login: process.env.MQTT_USER!,
  password: process.env.MQTT_PASSWORD!,
  server: process.env.MQTT_HOST!
};

// Entry point
const mqttConnector = new MqttService(mqttConfig);
const messageParsers = new Map<string, Plugin>();

start();
