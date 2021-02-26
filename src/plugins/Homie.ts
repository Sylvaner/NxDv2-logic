/**
 * Plugin pour la gestion des objets Philips Hue (version phue)
 */
import {Plugin} from './plugin';
import {CapabilityAccessor, Device, DeviceCategories} from '../models/Device';
import {StoreService} from "../services/StoreService";
import {StateService} from "../services/StateService";

export class Homie implements Plugin {
  private cache = new Map<string, Device>()
  private lastCacheChange: number = 0;
  private lastCacheSave: number = -1;
  private saveToDbLoop: NodeJS.Timeout;
  
  /**
   * Constructeur
   * Lance la sauvegarde du cache à un interval régulier
   */
  constructor() {
    this.saveToDbLoop = setInterval(async () => {
      await this.saveCacheInDb();
    }, 10000);
  }

  /**
   * Get plugin name
   *
   * @returns Plugin name
   */
  getName(): string {
    return 'Homie';
  }

  /**
   * Stop plugin
   */
  stop() {
    clearInterval(this.saveToDbLoop);
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicsPrefixs(): string[] {
    return ['homie'];
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getTopicsToSubscribe(): string[] {
    return ['homie/#'];
  }

  /**
   * Sauvegarde le cache en base de données
   */
  async saveCacheInDb() {
    if (this.lastCacheChange > this.lastCacheSave) {
      const storeService = StoreService.getInstance();
      // Sauvegarde l'ensemble des devices
      for (const deviceIdentifier of this.cache.keys()) {
        // Test si le device a déjà un champ _id pour éviter un doublon en base de données
        if (!('_id' in this.cache.get(deviceIdentifier)!.data)) {
          // Essai de le retrouver depuis la base de données si celui-ci existe
          try {
            const storedDevice = await storeService.getDevice(deviceIdentifier);
            if (storedDevice !== null && storedDevice !== undefined) {
              this.cache.get(deviceIdentifier)!.data._id = storedDevice._id;
              this.cache.get(deviceIdentifier)!.data.category = storedDevice.category;
              this.cache.get(deviceIdentifier)!.data.config = storedDevice.config;
            }
          } catch (_) { // Device not found
          }
        }
        // Sauvegarde
        try {
          this.cache.get(deviceIdentifier)!.data = await StoreService.getInstance().save(this.cache.get(deviceIdentifier)!.data);
        } catch (e) { console.error(e); }
      }
      this.lastCacheSave = Date.now();
    }
  }


  /**
   * Transform raw message from string to the best type
   *
   * @param rawData Data from message
   *
   * @return Transformed data
   */
  private static extratMessageData(rawData: string): any {
    let data: any = rawData
    if (/^\d+$/.test(rawData)) {
      data = parseInt(rawData, 10);
    } else if (rawData === 'true') {
      data = true;
    } else if (rawData === 'false') {
      data = false;
    }
    return data;
  }

  /**
   * Parse message from Mqtt
   *
   * @param topic Source topic of the message
   * @param message Message to parse
   */
  public async messageHandler(topic: string, message: Buffer) {
    // Data extraction from topic
    const dataFromTopic = topic.split('/');
    if (dataFromTopic.length > 2) {
      dataFromTopic.shift();
      const deviceId = dataFromTopic[0];
      let device: Device;
      let cacheChange = false;
      if (this.cache.has(deviceId)) {
        device = this.cache.get(deviceId)!;
      } else {
        device = new Device(deviceId, '', DeviceCategories.Unknown);
      }
      // Données du device
      if (dataFromTopic[1] === '$name') {
        device.setName(message.toString());
        cacheChange = true;
      // Status du device
      } else if (dataFromTopic[1] === '$reachable') {
        const capabilityName = 'reachable'
        device.setCapability(capabilityName, {
          get: { topic, path: '', type: 'string', format: 'raw' },
          set: { topic, path: '', type: 'string', format: 'raw' }
        });
        device.state[capabilityName] = message.toString();
        cacheChange = true;
      // Donnée d'état d'une capacité
      } else if (dataFromTopic.length === 3) {
        if (dataFromTopic[2][0] !== '$') {
          device.state[dataFromTopic[2]] = Homie.extratMessageData(message.toString());
          device.state = await StateService.getInstance().save(deviceId, device.state);
          cacheChange = true;
        }
      // Données sur une capacité
      } else if (dataFromTopic.length === 4) {
        const capabilityName = dataFromTopic[2];
        // Création de la capacité si elle n'a pas encore été créée
        if (device.data.capabilities[capabilityName] === undefined) {
          const dataTopic = `homie/${dataFromTopic[0]}/${dataFromTopic[1]}/${dataFromTopic[2]}`;
          const capability: CapabilityAccessor = {
            get: {topic: dataTopic, path: '', type: 'string', format: 'raw'},
            set: {topic: dataTopic, path: '', type: 'string', format: 'raw'}
          };
          device.setCapability(capabilityName, capability);
          cacheChange = true;
        }
        switch (dataFromTopic[3]) {
          case '$settable':
            const settable = Homie.extratMessageData(message.toString());
            if (!settable) {
              delete device.data.capabilities[capabilityName].set;
              cacheChange = true;
            }
            break;
          case '$datatype':
            device.data.capabilities[capabilityName].get!.type = message.toString();
            if (device.data.capabilities[capabilityName].set !== undefined) {
              device.data.capabilities[capabilityName].set!.type = message.toString();
            }
            cacheChange = true;
            break;
          default:
          case '$name':
            break;
        }
      }
      if (cacheChange) {
        this.cache.set(deviceId, device);
        this.lastCacheChange = Date.now();
      }
    }
  }
}