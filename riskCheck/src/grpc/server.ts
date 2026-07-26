import * as grpc from "@grpc/grpc-js";
import { proto } from "./proto.loader.js";
import { validateAndProcessOrderHandler } from "./handlers/order.handler.js";

export const createGrpcServer = (): grpc.Server => {
  const server = new grpc.Server();

  server.addService(proto.exchange.RiskService.service, {
    ValidateAndProcessOrder: validateAndProcessOrderHandler,
  });

  return server;
};
