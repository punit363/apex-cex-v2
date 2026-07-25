import { createClient, RedisClientType } from "redis";

class RedisHandler {
  private client!: RedisClientType;
  private static instance: RedisHandler;

  private init = async () => {
    this.client = createClient();
    await this.client.connect();
  };

  static createInstance = async () => {
    if (!this.instance) {
      this.instance = new RedisHandler();
      await this.instance.init();
    }
    return this.instance;
  };

  getTradeDetail = async () => {
    return await this.client.brPop("DB_UPDATE", 0);
  };
}

export default RedisHandler;
