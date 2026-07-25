import { createClient, RedisClientType } from "redis";
import { EngineRequest } from "./types/types";
import { generateEngineRequestId } from "./utils";

class RedisHandler {
  private client!: RedisClientType;
  private subscriber!: RedisClientType;
  private static instance: RedisHandler;

  init = async () => {
    this.client = createClient();
    this.subscriber = createClient();

    await this.client.connect();
    await this.subscriber.connect();

    this.client.on("error", (err: any) =>
      console.error("Redis Client Error", err)
    );
    this.subscriber.on("error", (err: any) =>
      console.error("Redis Publisher Error", err)
    );
  };

  static createInstance = async () => {
    if (!this.instance) {
      this.instance = new RedisHandler();
      await this.instance.init();
    }
    return this.instance;
  };

  get = async (key: string) => {
    return await this.client.get(key);
  };

  sendAndAwait = async (data: EngineRequest) => {
    const engineRequestId = generateEngineRequestId();
    const engine_data = {
      engine_request_id: engineRequestId,
      ...data,
    };
    await this.client.lPush("MESSAGE", JSON.stringify(engine_data));
    return new Promise((resolve, reject) => {
      this.subscriber.subscribe(engineRequestId, async (message) => {
        try {
          await this.subscriber.unsubscribe(engineRequestId);
          resolve(JSON.parse(message));
        } catch (err) {
          reject(err);
        }
      });
    });
  };
}
export default RedisHandler;
