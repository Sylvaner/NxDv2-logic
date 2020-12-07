/**
 * Plugin pour la gestion des objets Philips Hue (version phue)
 */
import { Plugin } from './plugin';
import { Light } from '../models/Light';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';
import { Sensor } from '../models/Sensor';

export class PHue implements Plugin {
  cache = {
    lights: new Map<string, Light>(),
    sensors: new Map<string, Sensor>()
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
  getTopicPrefix(): string {
    return 'phue';
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getSubscribeTopic(): string {
    return 'phue/#';
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
          let light: Light;
          // Test if device is in cache
          if (this.cache.lights.has(deviceId)) {
            // Device from cache
            light = this.cache.lights.get(deviceId) as Light;
          }
          else {
            // Try to load from database
            light = new Light(deviceId, deviceData.name);
            const lightData = await StoreService.getInstance().getDevice(deviceId);
            if (lightData === null) {
              // First time, create a new device
              const dataTopic = `phue/${extractedData[1]}/${deviceData.id}`;
              light.addCapabilities('reachable', {
                get: { topic: dataTopic, path: 'state.reachable' },
                set: { topic: dataTopic + '/set', path: 'reachable' }
              });
              light.addCapabilities('state', {
                get: { topic: dataTopic, path: 'state.on' },
                set: { topic: dataTopic + '/set', path: 'on' }
              });
              light.addCapabilities('brightness', {
                get: { topic: dataTopic, path: 'bri' },
                set: { topic: dataTopic + '/set', path: 'bri' }
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
          let sensor: Sensor;
          // Test if device is in cache
          if (this.cache.sensors.has(deviceId)) {
            // Device from cache
            sensor = this.cache.sensors.get(deviceId) as Light;
          }
          else {
            // Try to load from database
            sensor = new Sensor(deviceId, deviceData.name);
            const sensorData = await StoreService.getInstance().getDevice(deviceId);
            if (sensorData === null) {
              // First time, create a new device
              const dataTopic = `phue/${extractedData[1]}/${deviceData.id}`;
              if (deviceData.state.hasOwnProperty('buttonevent')) {
                sensor.addCapabilities('button', {
                  get: { topic: dataTopic, path: 'state.buttonevent' }
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