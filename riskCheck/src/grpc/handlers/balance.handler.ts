import * as grpc from "@grpc/grpc-js";
import { riskService } from "../../core/risk.service.js";
import RedisHandler from "../../redis.js";

export async function validateAndUpdateUserBalanceHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) {
  const { user_id, tx_id, asset, type, amount } = call.request;

  const numAmount = Number(amount);

  try {
    riskService.updateBalance(user_id, tx_id, asset, type, numAmount);

    console.log(`✅ [RISK CHECK] updated funds for ${user_id}`);
  } catch (riskError: any) {
    console.warn(`❌ [RISK CHECK] Balance rejected: ${riskError.message}`);

    return callback(null, {
      success: false,
      message: riskError.message,
      balance: tx_id,
    });
  }

  return callback(null, {
    success: true,
    message: "User balance successfully updated.",
    data: tx_id,
  });
}
