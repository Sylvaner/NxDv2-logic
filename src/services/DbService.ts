import { MongoClient, Db, Collection } from 'mongodb';

export interface DbCredentials {
  host: string,
  database: string,
  user: string,
  password: string
}

interface CollectionIndex {
  [key: string]: Collection
}

export class DbService {
  private client?: MongoClient;
  protected database?: Db;
  protected collections: CollectionIndex = {};

  public connect(credentials: DbCredentials, targetCollections: string[]): Promise<void> {
    return new Promise(async (resolve) => {
      const uri = `mongodb://${credentials.user}:${credentials.password}@${credentials.host}/${credentials.database}?w=majority`;
      this.client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      try {
        await this.client.connect();
        this.database = this.client.db(credentials.database);
        const collections = await this.database.collections();
        for (const collection of collections) {
          this.collections[collection.collectionName] = collection;
        }
        for (const targetCollection of targetCollections) {
          if (this.collections[targetCollection] === undefined) {
            this.collections[targetCollection] = await this.database.createCollection(targetCollection);
          }
        }
        resolve();
      } catch (err) {
        console.log(err);
      }
    });
  }
}