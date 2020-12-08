import { MongoClient, Db, Collection } from 'mongodb';
interface CollectionIndex {
  [key: string]: Collection
}

export class DbService {
  private client?: MongoClient;
  protected database?: Db;
  protected collections: CollectionIndex = {};
  public baseCollections: string[] = [];

  public connect(credentials: any): Promise<void> {
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
        for (const baseCollection of this.baseCollections) {
          if (this.collections[baseCollection] === undefined) {
            this.collections[baseCollection] = await this.database.createCollection(baseCollection);
          }
        }
        resolve();
      } catch (err) {
        console.log(err);
      }
    });
  }
}