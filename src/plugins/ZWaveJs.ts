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
import { CapabilityAccessor, Device, DeviceCagories } from '../models/Device';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';

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

export class ZWaveJs implements Plugin {
  advancedMode = false;
  debug = false;

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
    return 'ZWave JS';
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicPrefix(): string {
    return 'zwavejs';
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getSubscribeTopic(): string {
    return 'zwavejs/#';
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
          this.cache.devices.get(deviceIdentifier)!.data = await StoreService.getInstance().save(this.cache.devices.get(deviceIdentifier)!.data);
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
   * @param objectCagory Cagory de l'objet défini par le topic
   * @param device Information du périphérique
   * @param deviceData Données du périphérique
   */
  checkCagoryAndAddToCache(objectCagory: string, device: Device, deviceData: any): void {
    if (device.deviceCagory === DeviceCagories.Unknown) {
      // Les lumières sont prioritaires
      if (objectCagory === 'light') {
        device.deviceCagory = DeviceCagories.Light;
        device.data.category = DeviceCagories.Light;
        // Détection d'une prise
      } else if (objectCagory === 'switch') {
        device.deviceCagory = DeviceCagories.Switch;
        device.data.category = DeviceCagories.Switch;
      } else if (deviceData.device_class === 'door') {
        device.deviceCagory = DeviceCagories.Sensor;
        device.data.category = DeviceCagories.Sensor;
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
   * @param objectCagory Cagory de l'objet
   * @param capabilityName Nom de la capacité
   * @param deviceName Nom du device pour Zwavejs2mqtt
   */
  extractDataFromName(objectCagory: string, capabilityName: string, deviceName: string): ExtractedData | null {
    // Transformation du nom pour rechercher sa fonction
    const baseName = capabilityName.replace(deviceName + '_', '').toLowerCase();
    // Les lumières avec une luminosité
    if (objectCagory === 'light' && baseName.indexOf('dimmer') !== -1) {
      return {
        name: 'brightness',
        type: 'number'
      }
    } else if (objectCagory === 'switch' && baseName.indexOf('switch') !== -1) {
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
    } else if (objectCagory === 'sensor') {
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
      if (baseName === 'illuminance') {
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
      if (baseName === 'battery_level') {
        return {
          name: 'battery',
          type: 'number'
        }
      }
      // Contact / Présence
      if (baseName === 'notification_access control') {
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
   * @param objectCagory Cagory de l'objet
   * @param capabilityData Données de la capacité
   */
  getCapability(objectCagory: string, capabilityData: any): ExtractedCapability | null {
    const dataFromName = this.extractDataFromName(objectCagory, capabilityData.name, capabilityData.device.name);
    if (dataFromName !== null) {
      const capability: ExtractedCapability | null = { name: '', accessor: {} };
      capability.name = dataFromName.name;
      // Ajoute l'état si il existe
      if ('state_topic' in capabilityData) {
        capability.accessor.get = {
          topic: capabilityData.state_topic,
          path: 'value',
          format: 'json',
          type: dataFromName.type
        };
        if ('unit_of_measurement' in capabilityData) {
          capability.accessor.get.unit = capabilityData.unit_of_measurement;
        }
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
   * @param objectCagory Cagory de l'objet depuis le topic
   * @param message Message MQTT contenant les données
   */
  async readFromDiscovery(objectCagory: string, message: Buffer) {
    const capabilityData = JSON.parse(message.toString());
    let deviceIdentifier = 'zwavejs-' + capabilityData.device.name;
    // Première recherche dans le cache, l'identifiant du topic peut intégrer la salle dans la configuration
    // TODO: A vérifier
    if (!this.cache.devices.has(deviceIdentifier)) {
      // Recherche à partir d'un topic, si les salles sont entrées dans le plugin,
      // Le nom de la salle est intégré à l'identifiant du device, mais pas pour le topic
      if ('state_topic' in capabilityData) {
        // Extrait l'identifiant
        const extractIdRegex = /^zwavejs\/(.*?)\/.*/;
        const extractedId = extractIdRegex.exec(capabilityData.state_topic);
        if (extractedId !== null) {
          deviceIdentifier = 'zwavejs-' + extractedId[1];
        }
      }
    }

    let device: Device;
    if (this.cache.devices.has(deviceIdentifier)) {
      device = this.cache.devices.get(deviceIdentifier)!;
    } else {
      device = new Device(deviceIdentifier, capabilityData.device.name, DeviceCagories.Unknown);
    }
    const capabilityToAdd = this.getCapability(objectCagory, capabilityData);
    if (capabilityToAdd !== null) {
      // Mise en cache du topic pour la lecture des états
      // Ce cache permet de retrouver directement le nom de la capacité
      // en fonction du topic lu
      if ('get' in capabilityToAdd.accessor) {
        const topicCache: TopicCache = { deviceIdentifier, capability: capabilityToAdd.name };
        this.topicsCache.set(capabilityData.state_topic, topicCache);
      }
      device.setCapability(capabilityToAdd.name, capabilityToAdd.accessor);
      this.checkCagoryAndAddToCache(objectCagory, device, capabilityData.device);
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
    const deviceRegex = /^zwavejs\/(.*?)\/(.*?)\/(.*)$/;
    const extractedData = deviceRegex.exec(topic);
    if (extractedData !== null) {
      if (extractedData[1] === '_DISCOVERY') {
        this.readFromDiscovery(extractedData[2], message);
      } else {
        // Test le topic est connu
        if (this.topicsCache.has(topic)) {
          const target = this.topicsCache.get(topic)!;
          const data = JSON.parse(message.toString());
          // Test si une donnée est à sauvegarder
          if ('value' in data) {
            const deviceState = this.cache.devices.get(target.deviceIdentifier)!.state;
            deviceState[target.capability] = data.value;
            this.cache.devices.get(target.deviceIdentifier)!.state = await StateService.getInstance().save(target.deviceIdentifier, deviceState);
          }
        }
      }
    }
  }
}