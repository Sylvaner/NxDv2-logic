import { DeviceData } from '../models/Device';
import { DbService } from './DbService';

const DEVICES_COLLECTION = 'devices';

export class StoreService extends DbService {
  private static instance?: StoreService;

  private constructor() {
    super();
  }

  public static getInstance(): StoreService {
    if (StoreService.instance === undefined) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance!;
  }

  public async save(deviceToSave: DeviceData): Promise<DeviceData> {
    // Déplacer à la connexion
    if (this.collections[DEVICES_COLLECTION] === undefined) {
      this.collections[DEVICES_COLLECTION] = this.database!.collection(DEVICES_COLLECTION);
    }
    if (deviceToSave !== null) {
      if (deviceToSave._id === undefined) {
        await this.collections[DEVICES_COLLECTION].insertOne(deviceToSave);
      } else {
        await this.collections[DEVICES_COLLECTION].replaceOne({ _id: deviceToSave._id }, deviceToSave);
      }
    }
    return deviceToSave;
  }

  public getDevice(deviceId: string): Promise<DeviceData> {
    return new Promise((resolve, reject) => {
      if (this.collections[DEVICES_COLLECTION] === undefined) {
        reject();
      }
      this.collections[DEVICES_COLLECTION].findOne({ id: deviceId }).then((targetDevice) => {
        resolve(targetDevice);
      }).catch(() => {
        reject();
      });
    })
  }
}
