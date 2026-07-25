import Engine from "./engine";
import RedisHandler from "./redis";

const main = async () => {
  const engine = new Engine();
  const redis = await RedisHandler.createInstance();

  while (true) {
    try {
      const message = await redis.getMessage();
      if (!message) continue;

      const parsed = JSON.parse(message.element);
      const engine_request_id = parsed.engine_request_id;

      switch (parsed.type) {
        case "ORDER":
          await engine.processOrderRequest(parsed.order, engine_request_id);
          break;
        case "BALANCE":
          await engine.processBalanceRequest(
            parsed.transaction,
            engine_request_id
          );
          break;
        case "USER":
          await engine.processUserRequest(parsed.user, engine_request_id);
          break;
        case "MARKET":
          await engine.processMarketRequest(parsed.market, engine_request_id);
          break;
        default:
          console.warn("Unknown action:", parsed.action);
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  }
};

main().catch(console.error);
