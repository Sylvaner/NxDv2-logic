import { Homie } from "../../src/plugins/Homie";
import { StateService } from '../../src/services/StateService';
import { StoreService } from '../../src/services/StoreService';
import { DbCredentials } from '../../src/services/DbService';

function createTestDevice(homiePlugin: Homie): void {
  homiePlugin.messageHandler('homie/lights-2/lights/$name', Buffer.from('Lights', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/$properties', Buffer.from('on,bri', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/on/$name', Buffer.from('On', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/on/$datatype', Buffer.from('boolean', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/on/$settable', Buffer.from('true', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/bri/$name', Buffer.from('Brightness', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/bri/$datatype', Buffer.from('integer', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/bri/$settable', Buffer.from('true', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/lights/bri/$format', Buffer.from('1:254', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/$homie', Buffer.from('4.0', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/$name', Buffer.from('My light', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/$state', Buffer.from('ready', 'utf8'));
  homiePlugin.messageHandler('homie/lights-2/$nodes', Buffer.from('lights', 'utf8'));
}

const dbCredentials: DbCredentials = {
  database: '',
  host: '',
  password: '',
  user: ''
}

describe('Homie', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  });

  test('Getters', () => {
    const homiePlugin = new Homie();
    expect(homiePlugin.getName()).toBe('Homie');
    expect(homiePlugin.getTopicsPrefixs()).toEqual(['homie']);
    expect(homiePlugin.getTopicsToSubscribe()).toEqual(['homie/#']);
  });

  test('Test device', () => {
    const homiePlugin = new Homie();
    // @ts-ignore
    expect(homiePlugin.saveToDbLoop).not.toBeUndefined();
    homiePlugin.stop();
    createTestDevice(homiePlugin);
    // @ts-ignore
    const extractedCache = homiePlugin.cache;
    expect(extractedCache.has('lights-2')).toBeTruthy();
    const device = extractedCache.get('lights-2');
    expect(device!.data.id).toBe('lights-2');
    expect(device!.data.name).toBe('My light');
    expect(device!.data.category).toBe('unknown');
    expect(device!.state.deviceId).toBe('lights-2');
    expect(Object.keys(device!.data.capabilities)).toHaveLength(2);
    expect(device!.data.capabilities.on.get!.topic).toBe('homie/lights-2/lights/on');
  });

  test('Store new device', async () => {
    await StoreService.getInstance().connect(dbCredentials, ['devices']);
    const homiePlugin = new Homie();
    homiePlugin.stop();
    createTestDevice(homiePlugin);
    // @ts-ignore
    await homiePlugin.saveCacheInDb();
    // @ts-ignore
    expect(homiePlugin.cache.get('lights-2').data._id).not.toBe('');
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOne.mock.calls.length).toBe(1);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].insertOne.mock.calls.length).toBe(1);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOneAndUpdate.mock.calls.length).toBe(0);
  });

  test('Store update device', async () => {
    await StoreService.getInstance().connect(dbCredentials, ['devices']);
    const homiePlugin = new Homie();
    homiePlugin.stop();
    createTestDevice(homiePlugin);
    // @ts-ignore
    homiePlugin.cache.get('lights-2').data._id = 'ABCD';
    // @ts-ignore
    homiePlugin.saveCacheInDb();
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].insertOne.mock.calls.length).toBe(0);
    // @ts-ignore
    expect(StoreService.getInstance().collections['devices'].findOneAndUpdate.mock.calls.length).toBe(1);
  });

  test('State device', async () => {
    await StateService.getInstance().connect(dbCredentials, ['states']);
    const homiePlugin = new Homie();
    homiePlugin.stop();
    createTestDevice(homiePlugin);
    homiePlugin.messageHandler('homie/lights-2/lights/on', Buffer.from('true', 'utf8'));
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[0][0].deviceId).toBe('lights-2');
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[0][1].on).toBeTruthy();
    homiePlugin.messageHandler('homie/lights-2/lights/bri', Buffer.from('125', 'utf8'));
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[1][0].deviceId).toBe('lights-2');
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls[1][1].bri).toBe(125);
    // @ts-ignore
    expect(StateService.getInstance().collections['states'].replaceOne.mock.calls.length).toBe(2);
  });
});