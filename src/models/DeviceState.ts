export default interface DeviceState {
  deviceId: string,
  date: number,
  [key: string]: string | number | boolean
}
