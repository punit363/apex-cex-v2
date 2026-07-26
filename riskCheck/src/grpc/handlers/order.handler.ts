import * as grpc from "@grpc/grpc-js";
import { riskService } from "../../core/risk.service.js";

export async function validateAndProcessOrderHandler(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) {
  const { user_id, order_id, price, quantity, side, base_asset, quote_asset } =
    call.request;

  const numPrice = Number(price);
  const numQuantity = Number(quantity);

  try {
    riskService.checkAndLockBalance(
      user_id,
      numQuantity,
      numPrice,
      side,
      quote_asset,
      base_asset
    );
    console.log(`✅ [RISK CHECK] Locked funds for order ${order_id}`);
  } catch (riskError: any) {
    console.warn(`❌ [RISK CHECK] Order rejected: ${riskError.message}`);

    return callback(null, {
      success: false,
      message: riskError.message,
      order_id,
    });
  }

  try {
    // const engineResponse: any = await executeOrderAsync(call.request);

    // if (!engineResponse?.success) {
    //   throw new Error(
    //     engineResponse?.message || "Engine execution rejected order"
    //   );
    // }

    return callback(null, {
      success: true,
      message: "Order risk check passed and submitted to engine.",
      order_id,
    });
  } catch (engineError: any) {
    console.error(
      `❌ [ENGINE ERROR] Submission failed: ${engineError.message}. Rolling back locked funds...`
    );
    // what if engine returns error after trade is complete
    // riskService.unlockBalance(
    //   user_id,
    //   numQuantity,
    //   numPrice,
    //   side,
    //   quote_asset,
    //   base_asset
    // );

    return callback(null, {
      success: false,
      message: engineError.message,
      order_id,
    });
  }
}
