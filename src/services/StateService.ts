import { DbService } from './DbService';
import DeviceState from '../models/Device';

const STATES_COLLECTION = 'states';

export class StateService extends DbService {
  private static instance?: StateService;

  private constructor() {
    super();
  }

  public static getInstance(): StateService {
    if (StateService.instance === undefined) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  public async save<T extends DeviceState>(deviceId: string, stateToSave: T): Promise<T> {
    try {
      await this.collections[STATES_COLLECTION].replaceOne({ deviceId }, stateToSave, { upsert: true });
    }
    catch (e) {
      console.error(e);
    }
    return stateToSave;
  }
}