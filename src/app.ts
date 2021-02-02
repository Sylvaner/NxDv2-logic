import { Plugin } from './plugins/plugin';
import { StoreService } from './services/StoreService';
import { StateService } from './services/StateService';
import { MqttConfig } from './interfaces/MqttConfig';
import { MqttService } from './services/MqttService';
import * as dotenv from 'dotenv';

/**
 * Subscribe topics for each plugins
 *
 * @param plugins Loaded plugins
 */
function subscribePluginsTopics(plugins: Map<string, Plugin>): void {
  // List of all topics to subscribe
  const topicsToSubscribe: string[] = [];

  plugins.forEach((translator) => {
    topicsToSubscribe.push(translator.getSubscribeTopic());
    messageParsers.set(translator.getTopicPrefix(), translator);
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
 * Read .env file
 */
function readConfigFile(): void {
  dotenv.config({ path: `${__dirname}/../.env` });
}

/**
 * Connect to database and start daemon
 */
function start(): void {
  const storeCredentials = {
    host: process.env.DB_HOST!,
    database: process.env.DB_DATABASE!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  };

  const stateCredentials = {
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
      mqttConnector.connect().then(() => {
        subscribePluginsTopics(plugins);
      });
    });
  });
}

// List of plugins
const enabledPlugins = ['Hue', 'PHue', 'ZWaveJs'];

const mqttConfig: MqttConfig = {
  login: process.env.MQTT_USER!,
  password: process.env.MQTT_PASSWORD!,
  server: process.env.MQTT_HOST!
};

// Entry point
const mqttConnector = new MqttService(mqttConfig);
const messageParsers = new Map<string, Plugin>();

readConfigFile();
start();
