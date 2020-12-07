import { Device, DeviceTypes } from './Device';
import DeviceState from './DeviceState';

interface LightState extends DeviceState {
  state?: boolean,
  brightness?: number,
  reachable?: boolean
}

export class Light extends Device {
  public state: LightState;

  constructor(id: string, name: string) {
    super(id, name, DeviceTypes.Light);
    this.state = { deviceId: id, date: Date.now() };
  }
};
