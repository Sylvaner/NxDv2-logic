import { MqttService } from "../../src/services/MqttService";

describe('MqttService', () => {
  test('connect', done => {
    const service: any = new MqttService({login: 'login', password: 'password', server: 'server', port: 999});
    service.connect(() => {
      expect(service.mqttClient.connectionString).toBe('mqtt://server:999');
      expect(service.mqttClient.connectionOptions.username).toBe('login');
      done();
    });
  });

  test('publish', done => {
    const service: any = new MqttService({login: '', password: '', server: ''});
    service.connect(() => {
      done();
    });
    service.publish('topic/test', {data: 'my_data'});
    service.publish('topic/test2', {data: 'a_string'});
    expect(service.mqttClient.publishedMessages).toHaveLength(2);
    expect(service.mqttClient.publishedMessages[0].topic).toBe('topic/test');
    expect(service.mqttClient.publishedMessages[1].data).toBe('{"data":"a_string"}');
  });

  test('subscribe', done => {
    const service: any = new MqttService({login: '', password: '', server: ''});
    service.connect(() => {
      done();
    });
    service.subscribe('test/#', jest.fn());
    service.subscribe(['test2/#', 'test3/#'], jest.fn());
    expect(service.mqttClient.subscribedTopics).toHaveLength(2);
    expect(service.mqttClient.subscribedTopics[1][1]).toBe('test3/#');
  });

  test('message parsing', done => {
    const service: any = new MqttService({login: '', password: '', server: ''});
    service.connect(() => {
      service.mqttClient.sendMessage('test/#', 'my_message');
    });
    service.subscribe('test/#', (topic: string, message: Buffer): void => {
      expect(topic).toBe('test/#');
      expect(message).toBe('my_message');
      done();
    });
  });
});