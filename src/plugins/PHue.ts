/**
 * Plugin pour la gestion des objets Philips Hue (version phue)
 */
import { Plugin } from './plugin';
import { Device, DeviceCategories } from '../models/Device';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';

export class PHue implements Plugin {
  cache = {
    lights: new Map<string, Device>(),
    sensors: new Map<string, Device>()
  }

  /**
   * Get plugin name
   *
   * @returns Plugin name
   */
  getName(): string {
    return 'Philips Hue (PHue)';
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicsPrefixs(): string[] {
    return ['phue'];
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getTopicsToSubscribe(): string[] {
    return ['phue/#'];
  }

  /**
   * Parse message from Mqtt
   *
   * @param topic Source topic of the message
   * @param message Message to parse
   */
  async messageHandler(topic: string, message: Buffer) {
    // Data extraction from topic
    const deviceRegex = /^phue\/(.*)\/(.*)$/;
    const extractedData = deviceRegex.exec(topic);
    if (extractedData !== null) {
      const deviceData = JSON.parse(message.toString());
      const deviceId = `phue-${extractedData[1]}-${deviceData.id}`;
      switch (extractedData[1]) {
        case 'lights':
        case 'groups':
          let light: Device;
          // Test if device is in cache
          if (this.cache.lights.has(deviceId)) {
            // Device from cache
            light = this.cache.lights.get(deviceId)!;
          }
          else {
            // Try to load from database
            light = new Device(deviceId, deviceData.name, DeviceCategories.Light);
            const lightData = await StoreService.getInstance().getDevice(deviceId);
            if (lightData === null) {
              // First time, create a new device
              const dataTopic = `phue/${extractedData[1]}/${deviceData.id}`;
              light.setCapability('reachable', {
                get: { topic: dataTopic, path: 'state.reachable', type: 'boolean', format: 'json' },
                set: { topic: dataTopic + '/set', path: 'reachable', type: 'boolean', format: 'json' }
              });
              light.setCapability('state', {
                get: { topic: dataTopic, path: 'state.on', type: 'boolean', format: 'json' },
                set: { topic: dataTopic + '/set', path: 'on', type: 'boolean', format: 'json' }
              });
              light.setCapability('brightness', {
                get: { topic: dataTopic, path: 'state.bri', type: 'number', format: 'json' },
                set: { topic: dataTopic + '/set', path: 'bri', type: 'number', format: 'json' }
              });
              light.data = await StoreService.getInstance().save(light.data);
            } else {
              light.data = lightData;
            }
          }
          // Update state
          if (light !== undefined) {
            light.state.state = deviceData.state.on;
            light.state.brightness = deviceData.state.bri;
            light.state.reachable = deviceData.state.reachable;
            light.state = await StateService.getInstance().save(deviceId, light.state);
            this.cache.lights.set(deviceId, light);
          }
          break;
        case 'sensors':
          let sensor: Device;
          // Test if device is in cache
          if (this.cache.sensors.has(deviceId)) {
            // Device from cache
            sensor = this.cache.sensors.get(deviceId)!;
          }
          else {
            // Try to load from database
            sensor = new Device(deviceId, deviceData.name, DeviceCategories.Sensor);
            const sensorData = await StoreService.getInstance().getDevice(deviceId);
            if (sensorData === null) {
              // First time, create a new device
              const dataTopic = `phue/${extractedData[1]}/${deviceData.id}`;
              if (deviceData.state.hasOwnProperty('buttonevent')) {
                sensor.setCapability('button', {
                  get: { topic: dataTopic, path: 'state.buttonevent', type: 'number', format: 'json' }
                });
              }
              sensor.data = await StoreService.getInstance().save(sensor.data);
            } else {
              sensor.data = sensorData;
            }
          }
          // Update state
          if (sensor !== undefined) {
            if (deviceData.state.hasOwnProperty('buttonevent')) {
              sensor.state.button = deviceData.state.buttonevent;
            }
            this.cache.sensors.set(deviceId, sensor);
          }
          break;
      }
    }
  }
}