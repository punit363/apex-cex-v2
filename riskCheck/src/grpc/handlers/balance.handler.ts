import * as grpc from "@grpc/grpc-js";
import { riskService } from "../../core/risk.service.js";

const validateAndUpdateUserBalanceHandler = async (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) => {
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
};

const fetchUserBalanceHandler = async (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) => {
  const { user_id } = call.request;

  try {
    const user_balance = riskService.getUserBalance(user_id);

    if (!user_balance) {
      return callback(null, {
        success: false,
        message: "❌ [RISK CHECK] Balance fetch: User balance not found",
        user_id,
        balances: {},
      });
    }
    console.log(`✅ [RISK CHECK] balance fetched for ${user_id}`);

    return callback(null, {
      success: true,
      message: "User balance successfully fetched.",
      user_id,
      balances: user_balance,
    });
  } catch (riskError: any) {
    console.warn(`❌ [RISK CHECK] Balance fetch: ${riskError.message}`);

    return callback(null, {
      success: false,
      message: riskError.message,
      user_id,
      balances: {},
    });
  }
};

const createUserBalanceHandler = async (
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
) => {
  const { user_id } = call.request;

  try {
    const user_balance = riskService.getUserBalance(user_id);

    if (user_balance) {
      return callback(null, {
        success: false,
        message: "❌ [RISK CHECK] Balance create: User balance already exists",
        user_id,
        balances: user_balance,
      });
    }
    riskService.createUserBalance(user_id);
    console.log(`✅ [RISK CHECK] balance created for ${user_id}`);

    return callback(null, {
      success: true,
      message: "User balance created successfully.",
    });
  } catch (riskError: any) {
    console.warn(`❌ [RISK CHECK] Balance create: ${riskError.message}`);

    return callback(null, {
      success: false,
      message: riskError.message,
    });
  }
};

export {
  validateAndUpdateUserBalanceHandler,
  fetchUserBalanceHandler,
  createUserBalanceHandler,
};
