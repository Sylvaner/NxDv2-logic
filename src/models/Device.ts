import { MqttAccessDesc } from '../services/MqttService';

/**
 * Main categories
 */
export enum DeviceCategories {
  Light = 'light',
  Sensor = 'sensor',
  Switch = 'switch',
  Other = 'other',
  Unknown = 'unknown'
}

/**
 * State of the device
 */
export default interface DeviceState {
  deviceId: string,
  date: number,
  [key: string]: string | number | boolean
}

/**
 * Description of the device
 */
export interface DeviceData {
  // MongoDb ID
  _id?: string,
  // Mqtt ID
  id: string,
  // Mqtt name
  name: string,
  // List of capabilities
  capabilities: Capabilities,
  // Main category
  category: DeviceCategories,
  // Configuration
  config: object
}

/**
 * Mqtt topic access description
 */
export interface CapabilityAccessor {
  get?: MqttAccessDesc,
  set?: MqttAccessDesc
}

/**
 * List of capabilities
 */
export interface Capabilities {
  [capabilityName: string]: CapabilityAccessor
}

export class Device {
  public data: DeviceData;
  public state: DeviceState;

  constructor(id: string, name: string, deviceCategory: DeviceCategories) {
    this.data = {
      id,
      name,
      capabilities: {},
      category: deviceCategory,
      config: {}
    };
    this.state = { deviceId: id, date: Date.now() };
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
