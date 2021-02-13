import { MqttAccessDesc } from '../interfaces/MqttAccessDesc';
import DeviceState from './DeviceState';

export enum DeviceCagories {
  Light = 'light',
  Sensor = 'sensor',
  Switch = 'switch',
  Other = 'other',
  Unknown = 'unknown'
}

export interface DeviceData {
  _id?: string,
  id: string,
  name: string,
  capabilities: Capabilities,
  category: DeviceCagories,
  config: object
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
  public deviceCagory: string = '';

  constructor(id: string, name: string, deviceCagory: DeviceCagories) {
    this.data = {
      id,
      name,
      capabilities: {},
      category: deviceCagory,
      config: {}
    };
    this.state = { deviceId: id, date: Date.now() };
    this.deviceCagory = deviceCagory;
  }

  /**
   * Set device name
   * @param name New name
   */
  public setName(name: string) {
    this.data.name = name;
  }

  /**
   * Définir une capacité à un équipement
   * @param name Nom de la capacité
   * @param capability Données de la capacité
   */
  public setCapability(name: string, capability: CapabilityAccessor) {
    this.data.capabilities[name] = capability;
  }
}
