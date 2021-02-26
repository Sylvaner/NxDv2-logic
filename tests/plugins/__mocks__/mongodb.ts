interface MockedMongoClientOptions {
  useNewUrlParser: boolean,
  useUnifiedTopology: boolean
}

class MockedCollection {
  constructor(public collectionName: string) {}
  insertOne = jest.fn().mockImplementation((value: any): Promise<void> => {
    return new Promise<void>((resolve) => {
      value._id = 'abcdef0123456789abcdef01';
      resolve();
    });
  });
  replaceOne = jest.fn();
  findOneAndUpdate = jest.fn().mockImplementation((filter: any, data: any, options: any): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolve();
    });
  });
  findOneAndReplace = jest.fn();
  findOne = jest.fn().mockImplementation(() => Promise.reject());
}

class MockedDb {
  collections() {
    return [
      new MockedCollection('states'),
      new MockedCollection('devices')
    ];
  }
}

class MockedMongoClient {
  db(credentials: any) {
    return new MockedDb();
  }
  constructor(uri: string, options: MockedMongoClientOptions) {
  }
  connect() {
  }
}

module.exports = {
  MongoClient: MockedMongoClient
}