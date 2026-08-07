import RedisHandler from "./redis.js";
import RiskRouter from "./router.js";
import { getAllActiveSymbols } from "./utils/index.js";

const main = async () => {
  const router = new RiskRouter();

  const redis = await RedisHandler.createInstance();

  const symbols = await getAllActiveSymbols(); // from shared config or a registry
  const streamKeys = symbols.map((s: string) => `trade:${s}`);

  redis.consumeOrderLoop("trade:BTC_USDT", async (engine_request, id) => {
    console.log("order_data+++++++", engine_request, "id", id);
    await router.routeEngineRequest(engine_request, id);
  });
};

main();
