import { Hue } from './plugins/hue';
import { PHue } from './plugins/phue';
import { ZWaveJs } from './plugins/zwavejs2mqtt';
import { Plugin } from './plugins/plugin';
import { StoreService } from './services/StoreService';
import { StateService } from './services/StateService';
import { MqttConfig } from './interfaces/MqttConfig';
import { MqttService } from './services/MqttService';
import * as dotenv from 'dotenv';

/**
 * Called on Mqtt connection
 * @param plugins Loaded plugins
 */
function mqttConnected(plugins: Map<string, Plugin>): void {
  // List of all topics to subscribe
  const topicsToSubscribe: string[] = [];

  plugins.forEach((translator) => {
    topicsToSubscribe.push(translator.getSubscribeTopic());
    messageParsers.set(translator.getTopicPrefix(), translator);
  });
  mqttConnector.multipleSubscribes(topicsToSubscribe, mqttMessageParser);
}

/**
 * Send message from topic to the good plugins
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
    const pluginInstance: Plugin = new (availablePlugins.get(pluginName))();
    console.log('Loading plugin ' + pluginInstance.getName());
    plugins.set(pluginInstance.getName(), pluginInstance);
  });
  return plugins;
}

// List of plugins
const enabledPlugins = ['Hue', 'PHue', 'ZWaveJs'];
const availablePlugins = new Map<string, any>();
availablePlugins.set('Hue', Hue);
availablePlugins.set('PHue', PHue);
availablePlugins.set('ZWaveJs', ZWaveJs);

// Read config
dotenv.config({ path: `${__dirname}/../.env` });

const mqttConfig: MqttConfig = {
  login: process.env.MQTT_USER!,
  password: process.env.MQTT_PASSWORD!,
  server: process.env.MQTT_HOST!
};

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

const storeBaseCollections = [
  'devices',
  'zones'
];

const stateBaseCollections = [
  'states'
];

// Entry point
const mqttConnector = new MqttService(mqttConfig);
const messageParsers = new Map<string, Plugin>();

const storeService = StoreService.getInstance() as StoreService;
storeService.baseCollections = storeBaseCollections;
const stateService = StateService.getInstance() as StateService;
stateService.baseCollections = stateBaseCollections;
storeService.connect(storeCredentials).then(() => {
  stateService.connect(stateCredentials).then(() => {
    const translators = initPlugins();
    mqttConnector.connect(() => {
      mqttConnected(translators);
    });
  });
});
