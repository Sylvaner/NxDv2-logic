import { BaseModel } from './BaseModel';
import ObjectState from './ObjectState';

interface SensorState extends ObjectState {
  event?: string,
  button?: string
}

export class Sensor extends BaseModel {
  public state: SensorState;

  constructor(id: string, name: string) {
    super(id, name, 'sensors');
    this.state = { objectId: id, date: Date.now() };
  }
};
