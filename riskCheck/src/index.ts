import * as grpc from "@grpc/grpc-js";
import { createGrpcServer } from "./grpc/server.js";

const bootstrap = () => {
  const server = createGrpcServer();
  const PORT = process.env.RISK_CHECK_PORT || "0.0.0.0:50051";

  server.bindAsync(
    PORT,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("❌ Failed to bind RiskCheck gRPC server:", err);
        process.exit(1);
      }
      console.log(`🚀 RiskCheck gRPC Server running on port ${port}`);
    }
  );
}

bootstrap();
