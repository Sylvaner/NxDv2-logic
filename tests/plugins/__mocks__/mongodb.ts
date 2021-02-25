interface MockedMongoClientOptions {
  useNewUrlParser: boolean,
  useUnifiedTopology: boolean
}

class MockedCollection {
  constructor(public collectionName: string) {}
  insertOne = jest.fn().mockImplementation((value) => Promise.resolve(() => {
    console.warn(value);
    value._id = '123456789';
    console.warn(value);
    return value;
  }));
  replaceOne = jest.fn();
  findOneAndUpdate = jest.fn();
  findOneAndReplace = jest.fn().mockImplementation(() => Promise.resolve());
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