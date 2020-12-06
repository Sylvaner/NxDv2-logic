import { MqttAccessDesc } from '../interfaces/MqttAccessDesc';
import ObjectState from './ObjectState';

export interface IoTObject {
  _id?: string
  id: string
  name: string
  capabilities: Capabilities;
}

export interface CapabilityAccessor {
  get?: MqttAccessDesc,
  set?: MqttAccessDesc
}

export interface Capabilities {
  [capabilityName: string]: CapabilityAccessor
}

export class BaseModel {
  public data: IoTObject;
  public state: ObjectState;
  public store: string = '';

  constructor(id: string, name: string, store: string) {
    this.data = {
      id,
      name,
      capabilities: {}
    };
    this.state = { objectId: id, date: Date.now() };
    this.store = store;
  }

  public addCapabilities(name: string, capability: CapabilityAccessor) {
    this.data.capabilities[name] = capability;
  }
};
