import ObjectState from '../models/ObjectState';
import { DbService } from './DbService';


export class StateService extends DbService {
  private static instance?: StateService;
  private statesCollection: string = 'states';

  private constructor() {
    super();
  }

  public static getInstance(): StateService {
    if (StateService.instance === undefined) {
      StateService.instance = new StateService();
    }
    return StateService.instance!;
  }

  public async save(objectId: string, stateToSave: ObjectState): Promise<ObjectState> {
    if (this.collections[this.statesCollection] === undefined) {
      this.collections[this.statesCollection] = this.database!.collection(this.statesCollection);
    }
    await this.collections[this.statesCollection].replaceOne({ objectId }, stateToSave, { upsert: true });
    return stateToSave;
  }
}