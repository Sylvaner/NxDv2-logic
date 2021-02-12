/**
 * Plugin pour la gestion des objets Philips Hue (version phue)
 */
import {Plugin} from './plugin';
import {CapabilityAccessor, Device, DeviceTypes} from '../models/Device';
import {StoreService} from "../services/StoreService";
import {StateService} from "../services/StateService";

export class Homie implements Plugin {
  private cache = new Map<string, Device>()
  private lastCacheChange: number = 0;
  private lastCacheSave: number = -1;

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
    return 'Homie';
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicPrefix(): string {
    return 'homie';
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getSubscribeTopic(): string {
    return 'homie/#';
  }

  /**
   * Sauvegarde le cache en base de données
   */
  async saveCacheInDb() {
    if (this.lastCacheChange > this.lastCacheSave) {
      const storeService = StoreService.getInstance();
      // Sauvegarde l'ensemble des devices
      for (const deviceIdentifier of this.cache.keys()) {
        try {
          // Test si le device a déjà un champ _id pour éviter un doublon en base de données
          if (!('_id' in this.cache.get(deviceIdentifier)!.data)) {
            // Essai de le retrouver depuis la base de données si celui-ci existe
            const storedDevice = await storeService.getDevice(deviceIdentifier);
            this.cache.get(deviceIdentifier)!.data._id = storedDevice._id
            this.cache.get(deviceIdentifier)!.data.type = storedDevice.type
            this.cache.get(deviceIdentifier)!.data.config = storedDevice.config
          }
        }
        catch (_) { }
        finally {
          // Sauvegarde
          this.cache.get(deviceIdentifier)!.data = await StoreService.getInstance().save(this.cache.get(deviceIdentifier)!.data);
        }
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
      if (this.cache.has(deviceId)) {
        device = this.cache.get(deviceId)!;
      } else {
        device = new Device(deviceId, '', DeviceTypes.Unknown);
      }
      // Données du device
      if (dataFromTopic[1] === '$name') {
        device.setName(message.toString());
      // Status du device
      } else if (dataFromTopic[1] === '$reachable') {
        const capabilityName = 'reachable'
        device.setCapability(capabilityName, {
          get: { topic, path: '', type: 'string', format: 'raw' },
          set: { topic, path: '', type: 'string', format: 'raw' }
        });
        device.state[capabilityName] = message.toString();
      // Donnée d'état d'une capacité
      } else if (dataFromTopic.length === 3) {
        if (dataFromTopic[2][0] !== '$') {
          device.state[dataFromTopic[2]] = Homie.extratMessageData(message.toString());
          device.state = await StateService.getInstance().save(deviceId, device.state);
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
        }
        switch (dataFromTopic[3]) {
          case '$settable':
            const settable = Homie.extratMessageData(message.toString());
            if (!settable) {
              delete device.data.capabilities[capabilityName].set;
            }
            break;
          case '$datatype':
            device.data.capabilities[capabilityName].get!.type = message.toString();
            if (device.data.capabilities[capabilityName].set !== undefined) {
              device.data.capabilities[capabilityName].set!.type = message.toString();
            }
            break;
          default:
          case '$name':
            break;
        }
      }
      this.cache.set(deviceId, device);
    }
  }
}