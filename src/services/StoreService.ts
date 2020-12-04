import { IoTObject } from '../models/BaseModel';
import { DbService } from './DbService';

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

  public async save(store: string, objectToSave: IoTObject): Promise<IoTObject> {
    if (this.collections[store] === undefined) {
      this.collections[store] = this.database!.collection(store);
    }
    if (objectToSave !== null) {
      if (objectToSave._id === undefined) {
        await this.collections[store].insertOne(objectToSave);
      } else {
        await this.collections[store].replaceOne({ _id: objectToSave._id }, objectToSave);
      }
    }
    return objectToSave;
  }

  public getObject(store: string, objectId: string): Promise<IoTObject> {
    return new Promise((resolve, reject) => {
      if (this.collections[store] === undefined) {
        reject();
      }
      this.collections[store].findOne({ id: objectId }).then((targetObject) => {
        resolve(targetObject);
      }).catch(() => {
        reject();
      });
    })
  }
}
