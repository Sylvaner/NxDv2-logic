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

  public save(deviceData: DeviceData): Promise<DeviceData> {
    return new Promise<DeviceData>(async (resolve, reject) => {
      if (deviceData !== null) {
        try {
          if (deviceData._id === undefined) {
            this.collections[DEVICES_COLLECTION].insertOne(deviceData).then(() => {
              resolve(deviceData);
            });
          } else {
            this.collections[DEVICES_COLLECTION].findOneAndUpdate({ _id: deviceData._id }, {
              $set: {
                id: deviceData.id,
                name: deviceData.name,
                capabilities: deviceData.capabilities
              }
            }).then(() => {
              resolve(deviceData);
            });
          }
        }
        catch (e) {
          reject(e);
        }
      }
      resolve(deviceData);
    });
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
