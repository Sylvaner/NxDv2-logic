import { MqttAccessDesc } from '../interfaces/MqttAccessDesc';
import DeviceState from './DeviceState';

export enum DeviceTypes {
  Light = 'light',
  Sensor = 'sensor',
  Other = 'other'
}

export interface DeviceData {
  _id?: string,
  id: string,
  name: string,
  capabilities: Capabilities,
  type: DeviceTypes
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

  constructor(id: string, name: string, deviceType: DeviceTypes) {
    this.data = {
      id,
      name,
      capabilities: {},
      type: deviceType
    };
    this.state = { deviceId: id, date: Date.now() };
    this.deviceType = deviceType;
  }

  public addCapabilities(name: string, capability: CapabilityAccessor) {
    this.data.capabilities[name] = capability;
  }
};
