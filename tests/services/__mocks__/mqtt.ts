class MockedMqttClient {
  connectionString: string = '';
  connectionOptions: object = {};
  onConnectCallback: () => void = () => { };
  onDisconnectCallback: () => void = () => { };
  onMessageCallback: (topic: string, message: any) => void = (a, b) => { };
  onErrorCallback: (e: any) => void = (e) => { };
  publishedMessages: {topic: string, data: any}[] = [];
  subscribedTopics: any[] = [];
  on(event: string, callbackFunction: any): void {
    switch (event) {
      case 'connect':
        this.onConnectCallback = callbackFunction;
        break;
      case 'error':
        this.onErrorCallback = callbackFunction;
        break;
      case 'disconnect':
        this.onDisconnectCallback = callbackFunction;
        break;
      case 'message':
        this.onMessageCallback = callbackFunction;
        break;
    }
  };
  publish(topic: string, data: any): void {
    this.publishedMessages.push({topic, data});
  };
  subscribe(topic: string): void {
    this.subscribedTopics.push(topic)
  };
  sendMessage(topic: string, message: string) {
    this.onMessageCallback(topic, message);
  }
};

module.exports = {
  Client: MockedMqttClient,
  connect: function(connectionString: string, connectionOptions: object) {
    const mqttClient = new this.Client();
    mqttClient.connectionString = connectionString;
    mqttClient.connectionOptions = connectionOptions;
    setTimeout(() => {
      mqttClient.onConnectCallback();
    }, 200);
    return mqttClient;
  }
};
