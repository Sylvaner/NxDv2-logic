import { Device, DeviceCategories } from "../../src/models/Device";

describe('Device', () => {
  test('constructor', () => {
    const timeBeforeCreation = Date.now();
    const device = new Device('test-id', 'Test device', DeviceCategories.Light);
    expect(device.state.date >= timeBeforeCreation).toBeTruthy();
    expect(device.state.date <= Date.now()).toBeTruthy();
    expect(device.data.id).toBe('test-id');
    expect(device.data.name).toBe('Test device');
    expect(device.state.deviceId).toBe('test-id');
    expect(device.data.category).toBe('light');
  });

  it('setname', () => {
    const device = new Device('test-id', 'New device', DeviceCategories.Unknown);
    device.setName('New name');
    expect(device.data.name).toBe('New name');
  });

  it('setCapability', () => {
    const device = new Device('test-id', 'New device', DeviceCategories.Unknown);
    device.setCapability('testCapability', {
      get: {
        topic: 'basetopic/test',
        type: 'number',
        format: 'raw'
      },
      set: {
        topic: 'targettopic/set',
        type: 'number'
      }
    });
    expect(Object.keys(device.data.capabilities).length).toBe(1);
    expect(device.data.capabilities.testCapability.get?.type).toBe('number');
    expect(device.data.capabilities.testCapability.set?.topic).toBe('targettopic/set');
    device.setCapability('secondCapability', {
      get: {
        topic: 'anothertopic/test',
        type: 'string',
        format: 'json'
      }
    });
    expect(Object.keys(device.data.capabilities).length).toBe(2);
    expect(device.data.capabilities.secondCapability.get?.format).toBe('json');
    device.setCapability('testCapability', {
      get: {
        topic: 'differenttopic',
        type: 'string',
        format: 'raw'
      }
    });
    expect(Object.keys(device.data.capabilities).length).toBe(2);
    expect(device.data.capabilities.testCapability.get?.topic).toBe('differenttopic');
    expect(device.data.capabilities.testCapability.set).toBeUndefined();
  });
});