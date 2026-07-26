import path from "path";
import { fileURLToPath } from "url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// 1. Reconstruct __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Resolve relative path to your .proto file
const PROTO_PATH = path.resolve(__dirname, "../../proto/order.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

// 2. Define the Request Handler
const validateAndProcessOrder = (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) => {
  // Extract order fields from call.request
  console.log(call.request,"grpc risk order handler");
  const {
    user_id,
    order_id,
    price,
    quantity,
    side,
    type,
    base_asset,
    quote_asset,
  } = call.request;

  console.log(
    `📥 [RISK CHECK] Received ${side.toUpperCase()} order from User: ${user_id}`
  );
  console.log(
    `   Order Details: ${quantity} ${base_asset} @ ${price} ${quote_asset}`
  );

  // TODO: Step 1 - Perform your balance / risk verification here (e.g., Redis Lua script)
  const hasSufficientBalance = true; // Replace with your balance logic

  if (!hasSufficientBalance) {
    console.warn(
      `❌ [RISK CHECK] Rejection: Insufficient balance for User: ${user_id}`
    );

    // Respond back to API Gateway with failure
    return callback(null, {
      success: false,
      message: "Insufficient balance to place order.",
      order_id: order_id,
    });
  }

  console.log(`✅ [RISK CHECK] Balance verified & locked for User: ${user_id}`);

  // TODO: Step 2 - Forward to Engine gRPC client next!

  // Send back success response to API Gateway
  callback(null, {
    success: true,
    message: "Order risk check passed successfully.",
    order_id: order_id,
  });
};

// 3. Start the gRPC Server
const startServer = () => {
  const server = new grpc.Server();

  // Register the service and its implementation
  server.addService(proto.exchange.RiskService.service, {
    ValidateAndProcessOrder: validateAndProcessOrder,
  });

  const PORT = "0.0.0.0:5005";
  server.bindAsync(
    PORT,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("❌ Failed to bind gRPC server:", err);
        return;
      }
      console.log(`🚀 RiskCheck gRPC Server running on port ${port}`);
    }
  );
};

startServer();
