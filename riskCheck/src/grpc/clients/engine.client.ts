import { promisify } from "util";
import * as grpc from "@grpc/grpc-js";
import { proto } from "../proto.loader.js";

const ENGINE_URL = process.env.ENGINE_GRPC_URL || "localhost:50052";

const rawEngineClient = new proto.exchange.EngineService(
  ENGINE_URL,
  grpc.credentials.createInsecure()
);

// Promisify client method so handlers can use clean async/await
export const executeOrderAsync = promisify(
  rawEngineClient.ExecuteOrder
).bind(rawEngineClient);