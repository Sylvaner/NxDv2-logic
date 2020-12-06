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
    const objectRegex = /^phue\/(.*)\/(.*)$/;
    const extractedData = objectRegex.exec(topic);
    if (extractedData !== null) {
      const objectData = JSON.parse(message.toString());
      const objectId = `phue-${extractedData[1]}-${objectData.id}`;
      switch (extractedData[1]) {
        case 'lights':
        case 'groups':
          let light: Light;
          // Test if object is in cache
          if (this.cache.lights.has(objectId)) {
            // Object from cache
            light = this.cache.lights.get(objectId) as Light;
          }
          else {
            // Try to load from database
            light = new Light(objectId, objectData.name);
            const lightData = await StoreService.getInstance().getObject('lights', objectId);
            if (lightData === null) {
              // First time, create a new object
              const dataTopic = `phue/${extractedData[1]}/${objectData.id}`;
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
              light.data = await StoreService.getInstance().save(light.store, light.data);
            } else {
              light.data = lightData;
            }
          }
          // Update state
          if (light !== undefined) {
            light.state.state = objectData.state.on;
            light.state.brightness = objectData.state.bri;
            light.state.reachable = objectData.state.reachable;
            light.state = await StateService.getInstance().save(objectId, light.state);
            this.cache.lights.set(objectId, light);
          }
          break;
        case 'sensors':
          let sensor: Sensor;
          // Test if object is in cache
          if (this.cache.sensors.has(objectId)) {
            // Object from cache
            sensor = this.cache.sensors.get(objectId) as Light;
          }
          else {
            // Try to load from database
            sensor = new Sensor(objectId, objectData.name);
            const sensorData = await StoreService.getInstance().getObject('sensors', objectId);
            if (sensorData === null) {
              // First time, create a new object
              const dataTopic = `phue/${extractedData[1]}/${objectData.id}`;
              if (objectData.state.hasOwnProperty('buttonevent')) {
                sensor.addCapabilities('button', {
                  get: { topic: dataTopic, path: 'state.buttonevent' }
                });
              }
              sensor.data = await StoreService.getInstance().save(sensor.store, sensor.data);
            } else {
              sensor.data = sensorData;
            }
          }
          // Update state
          if (sensor !== undefined) {
            if (objectData.state.hasOwnProperty('buttonevent')) {
              sensor.state.button = objectData.state.buttonevent;
            }
            this.cache.sensors.set(objectId, sensor);
          }
          break;
      }
    }
  }
}