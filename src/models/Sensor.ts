import { Device, DeviceTypes } from './Device';
import DeviceState from './DeviceState';

interface SensorState extends DeviceState {
  event?: string,
  button?: string
}

export class Sensor extends Device {
  public state: SensorState;

  constructor(id: string, name: string) {
    super(id, name, DeviceTypes.Sensor);
    this.state = { deviceId: id, date: Date.now() };
  }
};
