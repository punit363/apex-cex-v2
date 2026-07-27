import { createClient } from "redis";
import type { RedisClientType } from "redis";

class RedisHandler {
  private client!: RedisClientType;
  private static instance: RedisHandler;

  init = async () => {
    this.client = createClient();

    await this.client.connect();
  };

  static createInstance = async () => {
    if (!RedisHandler.instance) {
      RedisHandler.instance = new RedisHandler();
      await RedisHandler.instance.init();
    }
    return RedisHandler.instance;
  };

  addOrderRequestToEngineStream = async (market: string, order: any) => {
    await this.client.XADD(market, "*", { payload: JSON.stringify(order) });
  };
}
export default RedisHandler;
