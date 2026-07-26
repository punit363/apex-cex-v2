import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// 2. Resolve relative path to your .proto file
const PROTO_PATH = path.resolve(__dirname, "../../../proto/order.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;

export const riskCheckClient = new proto.exchange.RiskService(
  "localhost:5005",
  grpc.credentials.createInsecure()
);
