/**
 * Plugin pour la gestion des objets Philips Hue
 */
import { Plugin } from './plugin';
import { StoreService } from '../services/StoreService';
import { StateService } from '../services/StateService';
import { Device, DeviceCategories } from '../models/Device';

export class Hue implements Plugin {
  cache = {
    lights: new Map<string, Device>()
  }

  /**
   * Get plugin name
   *
   * @returns Plugin name
   */
  getName(): string {
    return 'Philips Hue';
  }

  /**
   * Get Mqtt topic prefix for matches
   *
   * @return Mqtt topic prefix
   */
  getTopicsPrefixs(): string[] {
    return ['hue'];
  }

  /**
   * Get topic to subscribe
   *
   * @returns Topic to subscribe
   */
  getTopicsToSubscribe(): string[] {
    return ['hue/status/lights/#'];
  }

  /**
   * Parse message from Mqtt
   *
   * @param topic Source topic of the message
   * @param message Message to parse
   */
  async messageHandler(topic: string, message: Buffer) {
    // Le nom de l'objet se trouve dans la topic
    const lightState: RegExp = /^hue\/status\/lights\/(.*)$/;
    const regExpResult = lightState.exec(topic);
    // Si la regex a matché
    if (regExpResult !== null) {
      const lightName = regExpResult[1];
      const lightData = JSON.parse(message.toString());
      let light: Device;
      const lightId = 'hue-' + lightName;
      // Test if device is in cache
      if (this.cache.lights.has(lightId)) {
        // Device from cache
        light = this.cache.lights.get(lightId)!;
      }
      else {
        // Try to load from database
        light = new Device(lightId, lightName, DeviceCategories.Light);
        try {
          light.data = await StoreService.getInstance().getDevice(lightId);
        }
        catch (_) {
          // First time, create a new device
          const dataTopic = 'hue/status/lights/' + lightName;
          light.setCapability('reachable', { get: { topic: dataTopic, path: 'hue_state.reachable', type: 'boolean', format: 'json' } });
          light.setCapability('state', { get: { topic: dataTopic, path: 'hue_state.on', type: 'boolean', format: 'json' } });
          light.setCapability('brightness', { get: { topic: dataTopic, path: 'hue_state.bri', type: 'number', format: 'json' } });
          light.data = await StoreService.getInstance().save(light.data);
        }
      }
      // Update state
      if (light !== undefined) {
        light.state.state = lightData.hue_state.on;
        light.state.brightness = lightData.hue_state.bri;
        light.state.reachable = lightData.hue_state.reachable;
        light.state = await StateService.getInstance().save(lightId, light.state);
        this.cache.lights.set(lightId, light);
      }
    }
  }
}