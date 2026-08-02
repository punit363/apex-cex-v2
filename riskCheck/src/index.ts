import * as grpc from "@grpc/grpc-js";
import { createGrpcServer } from "./grpc/server.js";
import RedisHandler from "./redis.js";
import { riskService } from "./core/risk.service.js";

const RISK_SHARD_ID = process.env.RISK_SHARD_ID || "1";
const trade_risk_stream = `risk:shard:1`;

const gRPCBootstrap = (): grpc.Server => {
  const server = createGrpcServer();
  const PORT = process.env.RISK_CHECK_PORT || "0.0.0.0:50051";

  server.bindAsync(PORT, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error("❌ Failed to bind RiskCheck gRPC server:", err);
      process.exit(1);
    }
    console.log(`🚀 RiskCheck gRPC Server running on port ${port} (shard ${RISK_SHARD_ID})`);
  });

  return server;
};

const main = async () => {
  try {
    const redis = await RedisHandler.createInstance();
    console.log(`📡 Consuming trade events from ${trade_risk_stream}`);
    await redis.consumeOrderLoop(trade_risk_stream, async (trade, id) => {
      await riskService.settleBalanceAfterTrade(trade);
    });
  } catch (err) {
    console.error("❌ Fatal error in risk consumer loop:", err);
    process.exit(1);
  }
};

const server = gRPCBootstrap();
main();

process.on("SIGTERM", () => {
  console.log("🛑 Shutting down gracefully...");
  server.tryShutdown(() => process.exit(0));
});