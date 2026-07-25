import { createClient, RedisClientType } from "redis";
class RedisHandler {
  private client!: RedisClientType;
  private publisher!: RedisClientType;
  private static instance: RedisHandler;

  init = async () => {
    this.client = createClient();
    this.publisher = createClient();

    await this.client.connect();
    await this.publisher.connect();
  };

  static createInstance = async () => {
    if (!RedisHandler.instance) {
      RedisHandler.instance = new RedisHandler();
      await RedisHandler.instance.init();
    }
    return RedisHandler.instance;
  };

  sendApiResponse = async (engine_response: any, engine_request_id: string) => {
    await this.publisher.publish(
      engine_request_id,
      JSON.stringify(engine_response)
    );
  };

  getMessage = async () => {
    const message = await this.client.brPop("MESSAGE", 0);
    return message;
  };

  sendToDB = async (data: any) => {
    const order = this.client.lPush("DB_UPDATE", JSON.stringify(data));
    return order;
  };

  publishOrder = (market: string, payload: any) => {
    return this.publisher.publish(`ORDER:${market}`, JSON.stringify(payload));
  };

  publishTrade = (market: string, payload: any) => {
    return this.publisher.publish(`TRADE:${market}`, JSON.stringify(payload));
  };

  publishTicker = (market: string, payload: any) => {
    return this.publisher.publish(`TICKER:${market}`, JSON.stringify(payload));
  };

  publishOrderBookWithQuantity = (market: string, payload: any) => {
    return this.publisher.publish(`BOOK:${market}`, JSON.stringify(payload));
  };

  setBookWithQuantity = (market: string, payload: any) => {
    return this.client.set(`DEPTH:${market}`, JSON.stringify(payload));
  };

  saveTickerData = async (
    market: string,
    trade: {
      market: string;
      price: number;
      quantity: number;
      trade_id: string;
    }
  ) => {
    const key = `TICKER_TRADES:${market}`;
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago

    try {
      await this.client.zAdd(key, { score: now, value: JSON.stringify(trade) });
      await this.client.zRemRangeByScore(key, 0, cutoff);

      const result = await this.client.zRange(key, 0, -1);

      const trade_arr = result.map((item) => JSON.parse(item));

      let low = Infinity;
      let high = 0;
      let volume = 0;

      for (const t of trade_arr) {
        if (t.price < low) low = t.price;
        if (t.price > high) high = t.price;
        volume += t.quantity;
      }

      const open = trade_arr[0]?.price || 0;
      const close = trade_arr[trade_arr.length - 1]?.price || 0;

      const ticker_details = {
        market,
        ticker: {
          low: low === Infinity ? "0" : String(low),
          high: String(high),
          volume: String(volume),
          open: String(open),
          close: String(close),
          lastPrice: String(close),
        },
      };

      await this.publishTicker(market, ticker_details);
    } catch (err: any) {
      console.error(
        `[CRITICAL] Failed to execute ticker save pipeline:`,
        err.message
      );
    }
  };
}
export default RedisHandler;
