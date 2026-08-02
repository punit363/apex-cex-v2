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

  addTradeUpdateToRiskCheckStream = async (risk_shard: string, order: any) => {
    await this.client.XADD(risk_shard, "*", {
      payload: JSON.stringify(order),
    });
  };

  private GROUP = "risk-trade-router-group";
  private CONSUMER = "router-1"; // unique per process/replica 1-> main engine 2-> backup starts only when 1 stops

  setupConsumerGroup = async (stream_key: string) => {
    try {
      await this.client.xGroupCreate(stream_key, this.GROUP, "$", {
        MKSTREAM: true,
      });
    } catch (error: any) {
      if (!error.message?.includes("BUSYGROUP")) {
        throw error; // anything else is a real problem — don't hide it
      }
    }
  };

  consumeOrderLoop = async (
    stream_key: string,
    onTrade: (trade: any, id: string) => Promise<void>
  ) => {
    console.log("router loop started");
    await this.setupConsumerGroup(stream_key);
    while (true) {
      const result = await this.client.xReadGroup(
        this.GROUP,
        this.CONSUMER,
        { key: stream_key, id: ">" }, // '>' = only entries never delivered to this group
        { COUNT: 10, BLOCK: 5000 }
      );
      console.log(result, "--------result");

      if (!result) continue;

      for (const stream of result) {
        for (const message of stream.messages) {
          try {
            const order = JSON.parse(message.message.payload);
            await onTrade(order, message.id);
            await this.client.xAck(stream_key, this.GROUP, message.id);
          } catch (err) {
            console.error(
              `failed processing order ${message.id}, will remain pending`,
              err
            );
          }
        }
      }
    }
  };
}
export default RedisHandler;
