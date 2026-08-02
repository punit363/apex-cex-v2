import RedisHandler from "./redis.js";
import RiskTradeRouter from "./router.js";
import { getAllActiveSymbols } from "./utils/index.js";

const main = async () => {
  const router = new RiskTradeRouter();

  const redis = await RedisHandler.createInstance();

  const symbols = await getAllActiveSymbols(); // from shared config or a registry
  const streamKeys = symbols.map((s: string) => `trade:${s}`);

  redis.consumeOrderLoop(
    'trade:BTC_USDT',
    async (order_data, id) =>{
      console.log("order_data+++++++", order_data, "id", id);
      await router.routeTradeDetails(order_data, id)}
  );
};

main();
