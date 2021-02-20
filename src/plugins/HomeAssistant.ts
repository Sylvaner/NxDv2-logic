/**
 * Plugin pour la gestion des objets Zwave avec le plugin zwavejs
 * 
 * Configuration du plugin 
 * MQTT -> Prefix : zwavejs
 * 
 * Gateway -> Type : Named topics
 *         -> Payload category  : JSON Time-Value
 *         -> Ignore location
 *         -> HASS Disocvery
 *         -> Retained Discovery
 *         -> Disovery prefix : zwavejs/_DISCOVERY
 */
/**
 *
 *
 * TODO gestion du state par la config
 *
 *
 *
 */
import { Plugin } from './plugin';
import { CapabilityAccessor, Device, DeviceCategories } from '../models/Device';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';
import { MqttAccessDesc } from '../interfaces/MqttAccessDesc';

interface TopicCache {
  deviceIdentifier: string,
  capability: string
}

interface ExtractedData {
  name: string,
  type: string
}

interface ExtractedCapability {
  name: string,
  accessor: CapabilityAccessor
}

export class HomeAssistant implements Plugin {
  advancedMode = false;
  debug = true;
  specificTopics: string[] = []

  cache = {
    devices: new Map<string, Device>(),
  };

  lastCacheChange: number = 0;
  lastCacheSave: number = -1;

  topicsCache = new Map<string, TopicCache>();

  /**
   * Constructeur
   * Lance la sauvegarde du cache à un interval régulier
   */
  constructor() {
    if (process.env.HA_TOPICS) {
      this.specificTopics = process.env.HA_TOPICS.split(',');
    }
    setInterval(async () => {
      await this.saveCacheInDb();
    }, 10000);
  }

  /**
   * Get plugin name
   *
   * @returns Plugin name
   */
  getName(): string {
    return 'HomeAssistant';
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicsPrefixs(): string[] {
    return ['homeassistant', ...this.specificTopics];
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getTopicsToSubscribe(): string[] {
    return ['homeassistant/#', ...this.specificTopics.map(topic => topic + '/#')];
  }

  /**
   * Sauvegarde le cache en base de données
   */
  async saveCacheInDb() {
    if (this.lastCacheChange > this.lastCacheSave) {
      const storeService = StoreService.getInstance();
      // Sauvegarde l'ensemble des devices
      for (const deviceIdentifier of this.cache.devices.keys()) {
        this.cleanBeforeSave(deviceIdentifier);
        try {
          // Test si le device a déjà un champ _id pour éviter un doublon en base de données
          if (!('_id' in this.cache.devices.get(deviceIdentifier)!.data)) {
            // Essai de le retrouver depuis la base de données si celui-ci existe
            this.cache.devices.get(deviceIdentifier)!.data._id = (await storeService.getDevice(deviceIdentifier))._id
          }
        }
        catch (_) { }
        finally {
          // Sauvegarde
          this.cache.devices.get(deviceIdentifier)!.data = await storeService.save(this.cache.devices.get(deviceIdentifier)!.data);
        }
      }
      this.lastCacheSave = Date.now();
    }
  }

  /**
   * Nettoie et ajoute certains paramètres manquant avant la sauvegarde
   *
   * @param deviceIdentifier Identifiant du périphérique
   */
  cleanBeforeSave(deviceIdentifier: string): void {
    const device = this.cache.devices.get(deviceIdentifier)!;
    // Ajout du reachable
    if (!('status' in device.data.capabilities)) {
      const mqttNode = device.data.id.replace('zwavejs-', '');
      device.setCapability('reachable', {
        get: {
          topic: 'zwavejs/' + mqttNode + '/status',
          path: 'value',
          format: 'json',
          type: 'boolean'
        }
      });
      this.cache.devices.set(deviceIdentifier, device);
    }
  }

  /**
   * Vérifie si un type peut être attribué puis sauvegarde le device dans le cache.
   *
   * @param objectCategory Category de l'objet défini par le topic
   * @param device Information du périphérique
   * @param deviceData Données du périphérique
   */
  checkCategoryAndAddToCache(objectCategory: string, device: Device, deviceData: any): void {
    if (device.data.category === DeviceCategories.Unknown) {
      // Les lumières sont prioritaires
      if (objectCategory === 'light') {
        device.data.category = DeviceCategories.Light;
        // Détection d'une prise
      } else if (objectCategory === 'switch') {
        device.data.category = DeviceCategories.Switch;
      } else if (deviceData.device_class === 'door') {
        device.data.category = DeviceCategories.Sensor;
      }
    }
    // Indique que le cache doit être sauvegardé
    this.lastCacheChange = Date.now();
    // Sauvegarde dans le cache
    this.cache.devices.set(device.data.id, device);
  }

  /**
   * Extrait les données à partir du nom du topic
   *
   * @param objectCategory Category de l'objet
   * @param capabilityName Nom de la capacité
   * @param deviceName Nom du device pour Zwavejs2mqtt
   */
  extractDataFromName(objectCategory: string, capabilityName: string, deviceName: string): ExtractedData | null {
    // Transformation du nom pour rechercher sa fonction
    const baseName = capabilityName.replace(deviceName + '_', '').replace(deviceName, '').trim().toLowerCase();
    // Les lumières avec une luminosité
    if (objectCategory === 'light' && baseName.indexOf('dimmer') !== -1) {
      return {
        name: 'brightness',
        type: 'number'
      }
    } else if (objectCategory === 'switch' && baseName.indexOf('switch') !== -1) {
      // Les switchs sont ont des états on/off
      const multipleSwitch = /(.*)_(\d+)/.exec(baseName);
      if (multipleSwitch !== null) {
        return {
          name: 'state' + multipleSwitch[2],
          type: 'boolean'
        };
      } else {
        return {
          name: 'state',
          type: 'boolean'
        };
      }
    } else if (objectCategory === 'sensor' || objectCategory === 'binary_sensor') {
      // Les sensors sont toutes les données pouvant êtres lues
      // Electrique
      const electricSensor = /^electric(\d*)_(\w+)_meter$/.exec(baseName);
      if (electricSensor !== null) {
        if (electricSensor[2] === 'w') {
          return {
            name: 'power' + electricSensor[1],
            type: 'number'
          };
        } else if (electricSensor[2] === 'kwh') {
          return {
            name: 'consumption' + electricSensor[1],
            type: 'number'
          };
        }
      }
      // Luminosité
      if (baseName.indexOf('illuminance') !== -1) {
        return {
          name: baseName,
          type: 'number'
        }
      }
      // Temperature
      if (baseName.indexOf('temperature') !== -1) {
        return {
          name: 'temperature',
          type: 'number'
        }
      }
      // Batterie
      if (baseName === 'battery_level' || baseName === 'battery') {
        return {
          name: 'battery',
          type: 'number'
        }
      }
      // Contact / Présence
      if (baseName === 'notification_access control' || baseName === 'occupancy') {
        return {
          name: 'contact',
          type: 'bool'
        }
      }
    }
    // En mode avancée, on retrouve également les capacités non reconnues
    if (this.advancedMode) {
      return {
        name: baseName,
        type: 'string'
      };
    } else if (this.debug) {
      console.log('Ignored ' + deviceName + ' -> ' + capabilityName + ' (' + baseName + ')');
    }
    return null;
  }

  /**
   * Obtenir la capacité à partir des données
   * @param objectCategory Category de l'objet
   * @param capabilityData Données de la capacité
   */
  getCapability(objectCategory: string, capabilityData: any): ExtractedCapability | null {
    const dataFromName = this.extractDataFromName(objectCategory, capabilityData.name, capabilityData.device.name);
    if (dataFromName !== null) {
      const capability: ExtractedCapability | null = { name: '', accessor: {} };
      capability.name = dataFromName.name;
      // State topic indique le topic pour avoir l'état
      if ('state_topic' in capabilityData) {
        const capabilityAccessor: MqttAccessDesc = {
          topic: capabilityData.state_topic,
          format: 'raw',
          type: dataFromName.type
        };
        // Value template indique le format du topic d'état
        if ('value_template' in capabilityData) {
          if (capabilityData.value_template.indexOf('{{ value_json.') === 0) {
            capabilityAccessor.format = 'json';
            capabilityAccessor.path = capabilityData.value_template.replace('{{ value_json.', '').replace(' }}', '');
          }
        }
        if ('unit_of_measurement' in capabilityData) {
          capabilityAccessor.unit = capabilityData.unit_of_measurement;
        }
        capability.accessor.get = capabilityAccessor;
      }
      // Ajouter de la commande si elle existe commande
      if ('command_topic' in capabilityData) {
        capability.accessor.set = {
          topic: capabilityData.command_topic,
          path: 'value',
          format: 'json',
          type: dataFromName.type
        };
      }
      return capability;
    }
    return null;
  }

  /**
   * Lit les informations depuis les topics du discovery
   * @param capabilityCategory Category de la capacité reçue
   * @param message Message MQTT contenant les données
   */
  async readFromDiscovery(capabilityCategory: string, message: Buffer) {
    const capabilityData = JSON.parse(message.toString());
    // Extraire le canal de base en fonction du state topic
    if ('state_topic' in capabilityData) {
      const prefixId = capabilityData.state_topic.split('/')[0] + '-';
      let deviceIdentifier = prefixId + capabilityData.device.name;
      let device: Device;
      if (this.cache.devices.has(deviceIdentifier)) {
        device = this.cache.devices.get(deviceIdentifier)!;
      } else {
        device = new Device(deviceIdentifier, capabilityData.device.name, DeviceCategories.Unknown);
      }
      const capabilityToAdd = this.getCapability(capabilityCategory, capabilityData);
      if (capabilityToAdd !== null) {
        // Mise en cache du topic pour la lecture des états
        // Ce cache permet de retrouver directement le nom de la capacité
        // en fonction du topic lu
        if ('get' in capabilityToAdd.accessor) {
          let cacheCapabilityName = capabilityToAdd.name;
          if (this.topicsCache.has(capabilityData.state_topic)) {
            cacheCapabilityName = 'multiple';
          }
          const topicCache: TopicCache = { deviceIdentifier, capability: cacheCapabilityName };
          this.topicsCache.set(capabilityData.state_topic, topicCache);
        }
        device.setCapability(capabilityToAdd.name, capabilityToAdd.accessor);
        this.checkCategoryAndAddToCache(capabilityCategory, device, capabilityData.device);
      }
    }
  }

  /**
   * Parse message from Mqtt
   *
   * @param topic Source topic of the message
   * @param message Message to parse
   */
  async messageHandler(topic: string, message: Buffer) {
    // Data extraction from topic
    if (topic.indexOf('homeassistant') === 0) {
      const deviceRegex = new RegExp('^homeassistant\/(.*?)[\/(.*?)]?\/(.*?)\/(.*?)\/config$');
      const extractedData = deviceRegex.exec(topic);
      if (extractedData !== null) {
        this.readFromDiscovery(extractedData[1], message);
      }
    } else {
      const deviceRegex = new RegExp('^(?:' + this.specificTopics.join('|') + ')\/([^\/]+)$');
      const extractedData = deviceRegex.exec(topic);
      try {
        if (extractedData !== null) {
          // Test le topic est connu
          if (this.topicsCache.has(topic)) {
            const target = this.topicsCache.get(topic)!;
            let deviceState = this.cache.devices.get(target.deviceIdentifier)!.state;
            deviceState['date'] = Date.now();
            let data: any = message.toString();
            // Tous les états sont stockés dans un JSON
            if (target.capability === 'multiple') {
              data = JSON.parse(data);
              Object.assign(deviceState, data);
            } else {
              // Test si la données est au format JSON
              if (this.cache.devices.get(target.deviceIdentifier)?.data.capabilities[target.capability].get?.type === 'json') {
                data = JSON.parse(data);
              }
              deviceState[target.capability] = data;
            }
            this.cache.devices.get(target.deviceIdentifier)!.state = await StateService.getInstance().save(target.deviceIdentifier, deviceState);
          }
        }    
      } catch(_) {}
    }
  }
}