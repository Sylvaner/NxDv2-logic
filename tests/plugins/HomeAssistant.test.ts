import { HomeAssistant } from "../../src/plugins/HomeAssistant";

describe('HomeAssistant', () => {
  test('Message from discovery', () => {
    const homeAssistantPlugin = new HomeAssistant();
    homeAssistantPlugin.messageHandler(
      'homeassistant/sensor/0x00158d0001e0b1f8/temperature/config',
      Buffer.from('{"availability":[{"topic":"zigbee2mqtt/bridge/state"}],"device":{"identifiers":["zigbee2mqtt_0x00158d0001e0b1f8"],"manufacturer":"Xiaomi","model":"Aqara human body movement and illuminance sensor (RTCGQ11LM)","name":"0x00158d0001e0b1f8","sw_version":"Zigbee2MQTT 1.17.1"},"device_class":"temperature","json_attributes_topic":"zigbee2mqtt/0x00158d0001e0b1f8","name":"0x00158d0001e0b1f8 temperature","state_topic":"zigbee2mqtt/0x00158d0001e0b1f8","unique_id":"0x00158d0001e0b1f8_temperature_zigbee2mqtt","unit_of_measurement":"°C","value_template":"{{ value_json.temperature }}"}', 'utf8')
      );
    homeAssistantPlugin.messageHandler(
      'homeassistant/sensor/0x00158d0001e0b1f8/illuminance_lux/config',
      Buffer.from('{"availability":[{"topic":"zigbee2mqtt/bridge/state"}],"device":{"identifiers":["zigbee2mqtt_0x00158d0001e0b1f8"],"manufacturer":"Xiaomi","model":"Aqara human body movement and illuminance sensor (RTCGQ11LM)","name":"0x00158d0001e0b1f8","sw_version":"Zigbee2MQTT 1.17.1"},"device_class":"illuminance","json_attributes_topic":"zigbee2mqtt/0x00158d0001e0b1f8","name":"0x00158d0001e0b1f8 illuminance lux","state_topic":"zigbee2mqtt/0x00158d0001e0b1f8","unique_id":"0x00158d0001e0b1f8_illuminance_lux_zigbee2mqtt","unit_of_measurement":"lx","value_template":"{{ value_json.illuminance }}"}', 'utf8')
    );
    expect(homeAssistantPlugin.cache.devices.has('zigbee2mqtt-0x00158d0001e0b1f8')).toBeTruthy();
    const device = homeAssistantPlugin.cache.devices.get('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(device!.data.id).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(device!.data.name).toBe('0x00158d0001e0b1f8');
    expect(device!.data.category).toBe('unknown');
    expect(device!.state.deviceId).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(Object.keys(device!.data.capabilities)).toHaveLength(2);
    clearInterval(homeAssistantPlugin.saveToDbLoop);
  });
});