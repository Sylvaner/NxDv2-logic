import { MqttAccessDesc } from '../interfaces/MqttAccessDesc';
import DeviceState from './DeviceState';

export interface DeviceData {
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

export class Device {
  public data: DeviceData;
  public state: DeviceState;
  public deviceType: string = '';

  constructor(id: string, name: string, deviceType: string) {
    this.data = {
      id,
      name,
      capabilities: {}
    };
    this.state = { deviceId: id, date: Date.now() };
    this.deviceType = deviceType;
  }

  public addCapabilities(name: string, capability: CapabilityAccessor) {
    this.data.capabilities[name] = capability;
  }
};
