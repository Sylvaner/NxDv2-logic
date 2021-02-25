import { Homie } from "../../src/plugins/Homie";

describe('Homie', () => {
  test('Test device', () => {
    const homiePlugin = new Homie();
    // @ts-ignore
    expect(homiePlugin.saveToDbLoop).not.toBeUndefined();
    homiePlugin.stop();
    homiePlugin.messageHandler('homie/lights-2/lights/$name', Buffer.from('Lights', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/$properties', Buffer.from('on,bri', 'utf8'));
    //homie.messageHandler('homie/lights-2/lights/on', Buffer.from('false', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/on/$name', Buffer.from('On', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/on/$datatype', Buffer.from('boolean', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/on/$settable', Buffer.from('true', 'utf8'));
    //homie.messageHandler('homie/lights-2/lights/bri', Buffer.from('125', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/bri/$name', Buffer.from('Brightness', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/bri/$datatype', Buffer.from('integer', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/bri/$settable', Buffer.from('true', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/lights/bri/$format', Buffer.from('1:254', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/$homie', Buffer.from('4.0', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/$name', Buffer.from('My light', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/$state', Buffer.from('ready', 'utf8'));
    homiePlugin.messageHandler('homie/lights-2/$nodes', Buffer.from('lights', 'utf8'));
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
});