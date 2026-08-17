import Engine from "./engine";
import RedisHandler from "./redis";

const MARKET = "BTC_USDT";

const main = async () => {
  
  const redis = await RedisHandler.createInstance();
  const engine = new Engine(redis);

  redis.consumeOrderLoop(
    MARKET,
    async (order, id) => await engine.processOrderRequest(order, id)
  );
};

main().catch(console.error);
