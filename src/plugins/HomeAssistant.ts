/**
 * Plugin pour la gestion du format HomeAssistant
 */
import { Plugin } from './plugin';
import { CapabilityAccessor, Device, DeviceCategories } from '../models/Device';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';
import { MqttAccessDesc, MqttFormat } from '../interfaces/MqttAccessDesc';

interface TopicCache {
  deviceIdentifier: string,
  capability: string
}

interface DeterminedData {
  name: string,
  type: string,
  unit?: string
}

interface ExtractedCapability {
  name: string,
  accessor: CapabilityAccessor
}

interface ValueFormat {
  format: MqttFormat,
  path?: string
}

export class HomeAssistant implements Plugin {
  // En mode avancé, l'ensemble des commandes sont ajoutées
  private advancedMode = false;
  private debug = false;
  private protocolTopics: string[] = []
  private cache = {
    devices: new Map<string, Device>(),
  };
  private lastCacheChange: number = 0;
  private lastCacheSave: number = -1;
  private topicsCache = new Map<string, TopicCache>();
  private saveToDbLoop: NodeJS.Timeout;

  /**
   * Constructeur
   * Lance la sauvegarde du cache à un interval régulier
   */
  constructor() {
    if (process.env.HA_TOPICS) {
      this.protocolTopics = process.env.HA_TOPICS.split(',');
    }
    this.saveToDbLoop = setInterval(async () => {
      await this.saveCacheInDb();
    }, 10000);
  }

  /**
   * Stop plugin
   */
  stop() {
    clearInterval(this.saveToDbLoop);
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
    return ['homeassistant', ...this.protocolTopics];
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getTopicsToSubscribe(): string[] {
    return ['homeassistant/#', ...this.protocolTopics.map(topic => topic + '/#')];
  }

  /**
   * Sauvegarde le cache en base de données
   */
  async saveCacheInDb() {
    if (this.lastCacheChange > this.lastCacheSave) {
      const storeService = StoreService.getInstance();
      // Sauvegarde l'ensemble des devices
      for (const deviceIdentifier of this.cache.devices.keys()) {
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
          if (this.debug) {
            console.log('Save device ' + deviceIdentifier);
            console.log(' - Capabilities: ' + Object.keys(this.cache.devices.get(deviceIdentifier)!.data.capabilities).join(', '));
          }
          this.cache.devices.get(deviceIdentifier)!.data = await storeService.save(this.cache.devices.get(deviceIdentifier)!.data);
        }
      }
      this.lastCacheSave = Date.now();
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
   * Détermine les données à partir du nom du topic
   *
   * @param objectCategory Category de l'objet
   * @param capabilityName Nom de la capacité
   * @param deviceName Nom du device pour Zwavejs2mqtt
   */
  determineDataFromName(objectCategory: string, capabilityName: string, deviceName: string): DeterminedData | null {
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
      // Peut avoir un numéro, une information sur le type de données et une information complémentaire
      const electricSensor = /^electric(\d*)_(\w+)_(.*)$/.exec(baseName);
      if (electricSensor !== null) {
        let suffix = '';
        if (electricSensor[1] !== '') {
          suffix += '_' + electricSensor[1];
        }
        if (electricSensor[3] !== '') {
          suffix += '_' + electricSensor[3];
        }
        let capabilityName = '';
        let unit = '';
        if (electricSensor[2] === 'w' || electricSensor[2] === 'power') {
          capabilityName = 'power' + suffix;
          unit = 'W';
        } else if (electricSensor[2] === 'kwh') {
          capabilityName = 'consumption' + suffix;
          unit = 'kWh';
        } else if (electricSensor[2] === 'a') {
          capabilityName = 'intensity' + suffix;
          unit = 'A';
        } else if (electricSensor[2] === 'v') {
          capabilityName = 'volt' + suffix;
          unit = 'V'
        }
        if (capabilityName !== '') {
          return {
            name: capabilityName,
            type: 'number',
            unit: unit
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
          type: 'number',
          unit: '°C'
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
   * Prépare l'objet de la capacité
   * 
   * @param determinedData Données de la capacité déterminées à partir du nom
   */
  prepareCapabilityAccessor(determinedData: DeterminedData): ExtractedCapability {
    const capability: ExtractedCapability | null = { name: '', accessor: {} };
    capability.name = determinedData.name;
    return capability;
  }

  /**
   * Extraire le format de donnée de la capacité
   * 
   * @param capabilityData Données de la capacité
   */
  extractValueFormat(capabilityData: any): ValueFormat | null {
    if ('value_template' in capabilityData) {
      const valueFormat: ValueFormat = {
        format: 'raw'
      }
      if (capabilityData.value_template.indexOf('{{ value_json.') === 0) {
        valueFormat.format = 'json';
        // Chemin de la donnée au format JSON
        valueFormat.path = capabilityData.value_template.replace('{{ value_json.', '').replace(' }}', '');
      }
    }
    return null;
  }

  /**
   * Obtenir la capacité à partir des données
   * @param objectCategory Category de l'objet
   * @param capabilityData Données de la capacité
   */
  getCapabilityData(objectCategory: string, capabilityData: any): ExtractedCapability | null {
    const determinedData = this.determineDataFromName(objectCategory, capabilityData.name, capabilityData.device.name);
    // Si la capacité est gérée
    if (determinedData !== null) {
      const capability = this.prepareCapabilityAccessor(determinedData);
      // State topic indique le topic pour avoir l'état
      const capabilityAccessor: MqttAccessDesc = {
        topic: capabilityData.state_topic,
        format: 'raw',
        type: determinedData.type
      };
      // Value template indique le format du topic d'état
      const valueFormat = this.extractValueFormat(capabilityData);
      if (valueFormat !== null) {
        capabilityAccessor.format = valueFormat.format;
        capabilityAccessor.path = valueFormat.path;
      }
      // Information sur l'unité
      if ('unit_of_measurement' in capabilityData) {
        capabilityAccessor.unit = capabilityData.unit_of_measurement;
      } else if ('unit' in determinedData) {
        capabilityAccessor.unit = determinedData.unit;
      }
      capability.accessor.get = capabilityAccessor;
      // Ajouter de la commande si elle existe commande
      if ('command_topic' in capabilityData) {
        capability.accessor.set = {
          topic: capabilityData.command_topic,
          path: '',
          format: 'raw',
          type: determinedData.type
        };
        // La commande a le même format que le statut
        if (valueFormat !== null) {
          capability.accessor.set.format = valueFormat.format;
          capability.accessor.set.path = valueFormat.path;
        }
      }
      return capability;
    }
    return null;
  }

  /**
   * Lit les informations depuis les topics du discovery
   * Format : https://www.home-assistant.io/docs/mqtt/discovery/
   * 
   * @param capabilityCategory Category de la capacité reçue
   * @param message Message MQTT contenant les données
   */
  async readFromDiscovery(capabilityCategory: string, message: Buffer) {
    const capabilityData = JSON.parse(message.toString());
    // Extraire le canal de base en fonction du state topic
    if ('state_topic' in capabilityData) {
      // Prefix contenant le topic de base des devices, en général le nom du protocol
      const prefixId = capabilityData.state_topic.split('/')[0] + '-';
      let deviceIdentifier = prefixId + capabilityData.device.name;
      let device: Device;
      // Récupération du device de périphérique depuis le cache ou création d'un nouveau
      if (this.cache.devices.has(deviceIdentifier)) {
        device = this.cache.devices.get(deviceIdentifier)!;
      } else {
        device = new Device(deviceIdentifier, capabilityData.device.name, DeviceCategories.Unknown);
      }
      const capabilityToAdd = this.getCapabilityData(capabilityCategory, capabilityData);
      if (capabilityToAdd !== null) {
        // Mise en cache du topic pour la lecture des états
        // Ce cache permet de retrouver directement le nom de la capacité
        // en fonction du topic lu
        if ('get' in capabilityToAdd.accessor) {
          let cacheCapabilityName = capabilityToAdd.name;
          // Changement du nom du raccourci à multiple dans le cas
          // d'un topic contenant plusieurs informations
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
    // Test si c'est un message
    if (topic.indexOf('homeassistant') === 0) {
      const configDataRegex = new RegExp('^homeassistant\/(.*?)[\/(.*?)]?\/(.*?)\/(.*?)\/config$');
      const extractedData = configDataRegex.exec(topic);
      if (extractedData !== null) {
        this.readFromDiscovery(extractedData[1], message);
      }
    } else {
      const deviceRegex = new RegExp('^(?:' + this.protocolTopics.join('|') + ')\/([^\/]+)$');
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