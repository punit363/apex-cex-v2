import { createClient, RedisClientType } from "redis";

class RedisHandler {
  private tradeSubscriber!: RedisClientType;
  private orderbookSubscriber!: RedisClientType;
  private static instance: RedisHandler;

  init = async () => {
    this.tradeSubscriber = createClient();
    this.orderbookSubscriber = createClient();

    await this.tradeSubscriber.connect();
    await this.orderbookSubscriber.connect();
  };

  static createInstance = async () => {
    if (!this.instance) {
      this.instance = new RedisHandler();
      await this.instance.init();
    }
    return this.instance;
  };

  subscribeToOrder = async (market: string, callback: (data: any) => void) => {
    await this.tradeSubscriber.subscribe(`ORDER:${market}`, (message) => {
      callback(JSON.parse(message));
    });
  };

  subscribeToTrade = async (market: string, callback: (data: any) => void) => {
    await this.tradeSubscriber.subscribe(`TRADE:${market}`, (message) => {
      callback(JSON.parse(message));
    });
  };

  subscribeToTicker = async (market: string, callback: (data: any) => void) => {
    await this.tradeSubscriber.subscribe(`TICKER:${market}`, (message) => {
      callback(JSON.parse(message));
    });
  };

  subscribeToOrderbook = async (
    market: string,
    callback: (data: any) => void
  ) => {
    await this.orderbookSubscriber.subscribe(`BOOK:${market}`, (message) => {
      callback(JSON.parse(message));
    });
  };
}

export default RedisHandler;
