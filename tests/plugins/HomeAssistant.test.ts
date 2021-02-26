import { HomeAssistant } from '../../src/plugins/HomeAssistant';
import { StoreService } from '../../src/services/StoreService';
import { StateService } from '../../src/services/StateService';

function createTestDevice(homeAssistant: HomeAssistant): void {
  homeAssistant.messageHandler(
    'homeassistant/sensor/0x00158d0001e0b1f8/temperature/config',
    Buffer.from('{"availability":[{"topic":"zigbee2mqtt/bridge/state"}],"device":{"identifiers":["zigbee2mqtt_0x00158d0001e0b1f8"],"manufacturer":"Xiaomi","model":"Aqara human body movement and illuminance sensor (RTCGQ11LM)","name":"0x00158d0001e0b1f8","sw_version":"Zigbee2MQTT 1.17.1"},"device_class":"temperature","json_attributes_topic":"zigbee2mqtt/0x00158d0001e0b1f8","name":"0x00158d0001e0b1f8 temperature","state_topic":"zigbee2mqtt/0x00158d0001e0b1f8","unique_id":"0x00158d0001e0b1f8_temperature_zigbee2mqtt","unit_of_measurement":"°C","value_template":"{{ value_json.temperature }}"}', 'utf8')
    );
    homeAssistant.messageHandler(
    'homeassistant/sensor/0x00158d0001e0b1f8/illuminance_lux/config',
    Buffer.from('{"availability":[{"topic":"zigbee2mqtt/bridge/state"}],"device":{"identifiers":["zigbee2mqtt_0x00158d0001e0b1f8"],"manufacturer":"Xiaomi","model":"Aqara human body movement and illuminance sensor (RTCGQ11LM)","name":"0x00158d0001e0b1f8","sw_version":"Zigbee2MQTT 1.17.1"},"device_class":"illuminance","json_attributes_topic":"zigbee2mqtt/0x00158d0001e0b1f8","name":"0x00158d0001e0b1f8 illuminance lux","state_topic":"zigbee2mqtt/0x00158d0001e0b1f8","unique_id":"0x00158d0001e0b1f8_illuminance_lux_zigbee2mqtt","unit_of_measurement":"lx","value_template":"{{ value_json.illuminance }}"}', 'utf8')
  );
}

describe('HomeAssistant', () => {
  beforeEach(() => {
    process.env.HA_TOPICS = 'zigbee2mqtt';
    jest.useFakeTimers()
  });
  
  test('Getters', () => {
    process.env.HA_TOPICS = '';
    const homeAssistantPlugin = new HomeAssistant();
    expect(homeAssistantPlugin.getName()).toBe('HomeAssistant');
    expect(homeAssistantPlugin.getTopicsPrefixs()).toEqual(['homeassistant']);
    expect(homeAssistantPlugin.getTopicsToSubscribe()).toEqual(['homeassistant/#']);
  });

  test('Topics prefixs', () => {
    const homeAssistantPlugin = new HomeAssistant();
    expect(homeAssistantPlugin.getTopicsPrefixs()).toEqual(['homeassistant', 'zigbee2mqtt']);
  });

  test('Test device', () => {
    const homeAssistantPlugin = new HomeAssistant();
    // @ts-ignore
    expect(homeAssistantPlugin.saveToDbLoop).not.toBeUndefined();
    homeAssistantPlugin.stop();
    createTestDevice(homeAssistantPlugin);
    // @ts-ignore
    expect(homeAssistantPlugin.cache.devices.has('zigbee2mqtt-0x00158d0001e0b1f8')).toBeTruthy();
    // @ts-ignore
    const device = homeAssistantPlugin.cache.devices.get('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(device!.data.id).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(device!.data.name).toBe('0x00158d0001e0b1f8');
    expect(device!.data.category).toBe('unknown');
    expect(device!.state.deviceId).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    expect(Object.keys(device!.data.capabilities)).toHaveLength(2);
    expect(device!.data.capabilities.temperature.get!.topic).toBe('zigbee2mqtt/0x00158d0001e0b1f8');
  });

  test('Store new device', async () => {
    await StoreService.getInstance().connect({}, ['devices']);
    const homeAssistantPlugin = new HomeAssistant();
    homeAssistantPlugin.stop();
    createTestDevice(homeAssistantPlugin);
    // @ts-ignore
    await homeAssistantPlugin.saveCacheInDb();
    // @ts-ignore
    expect(homeAssistantPlugin.cache.devices.get('zigbee2mqtt-0x00158d0001e0b1f8').data._id).not.toBe('');
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOne.mock.calls.length).toBe(1);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].insertOne.mock.calls.length).toBe(1);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOneAndUpdate.mock.calls.length).toBe(0);
  });

  test('Store update device', async () => {
    await StoreService.getInstance().connect({}, ['devices']);
    const homeAssistantPlugin = new HomeAssistant();
    homeAssistantPlugin.stop();
    createTestDevice(homeAssistantPlugin);
    // @ts-ignore
    homeAssistantPlugin.cache.devices.get('zigbee2mqtt-0x00158d0001e0b1f8').data._id = 'ABCD';
    // @ts-ignore
    homeAssistantPlugin.saveCacheInDb();
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].insertOne.mock.calls.length).toBe(0);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOneAndUpdate.mock.calls.length).toBe(1);
  });

  test('State device', async () => {
    await StateService.getInstance().connect({}, ['states']);
    const homeAssistantPlugin = new HomeAssistant();
    homeAssistantPlugin.stop();
    createTestDevice(homeAssistantPlugin);
    homeAssistantPlugin.messageHandler('zigbee2mqtt/0x00158d0001e0b1f8', Buffer.from('{"illuminance": 125}', 'utf8'));
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[0][0].deviceId).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[0][1].illuminance).toBe(125);
    homeAssistantPlugin.messageHandler('zigbee2mqtt/0x00158d0001e0b1f8', Buffer.from('{"temperature": 22}', 'utf8'));
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[1][0].deviceId).toBe('zigbee2mqtt-0x00158d0001e0b1f8');
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[1][1].temperature).toBe(22);
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls.length).toBe(2);
  });

});