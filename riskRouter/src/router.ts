import RedisHandler from "./redis.js";
import { getRiskShardId } from "./utils/index.js";

const redis = await RedisHandler.createInstance();

const streamTradeDetails = async (
  action: string,
  market: string,
  order: any,
  trades: any
) => {
  let net_qty = 0;
  let net_amt = 0;

  //orders already sitting in market
  trades.map(async (trade: any) => {
    net_amt += trade.price;
    net_qty += trade.quantity;

    const data = {
      action,
      trade: {
        user_id: trade.otherUserId,
        market,
        quantity: trade.quantity,
        price: trade.price,
        trade_id: trade.tradeId,
        order_id: trade.otherOrderId,
        filled: trade.otherOrderFilled,
        status: trade.otherOrderStatus,
        side: order.side === "BUY" ? "SELL" : "BUY",
        unsold_market_order_quanity: 0,
        unused_market_order_amount: 0,
      },
    };

    console.log("maker_trade", data, "maker_shard_id++++++++++++++++");
    const maker_shard_id = getRiskShardId(trade.otherUserId);
    await redis.addTradeUpdateToRiskCheckStream(maker_shard_id, data);
  });

  // order that came at last
  const data = {
    action,
    trade: {
      user_id: order.user_id,
      market,
      quantity: net_qty,
      price: net_amt,
      trade_id: null,
      order_id: order.order_id,
      filled: order.filled,
      status: order.status,
      side: order.side,
      unsold_market_order_quanity: order.unsold_market_order_quanity,
      unused_market_order_amount: order.unused_market_order_amount,
    },
  };

  console.log("taker_trade", data, "taker_shard_id++++++++++++++++");
  const taker_shard_id = getRiskShardId(order.user_id);
  await redis.addTradeUpdateToRiskCheckStream(taker_shard_id, data);

  //need side data BUY/SELL?
};

const streamCancellationDetails = async (
  action: string,

  market: string,
  cancelled_order: any
) => {
  const data = {
    action,
    cancelled_order_data: {
      market,
      ...cancelled_order,
    },
  };

  console.log(
    "cancelled_order_data",
    data,
    "cancelled_order_data++++++++++++++++"
  );
  const user_shard_id = getRiskShardId(cancelled_order.user_id);
  await redis.addTradeUpdateToRiskCheckStream(user_shard_id, data);
};

class RiskRouter {
  public async routeEngineRequest(engine_request: any, id: string) {
    if (engine_request.action === "TRADE_EXECUTED") {
      console.log(
        "Routing trade details for order:",
        engine_request.order,
        "with trades:",
        engine_request.trades
      );

      streamTradeDetails(
        engine_request.action,

        engine_request.market,
        engine_request.placed_order,
        engine_request.trades
      );
    } else if (engine_request.action === "ORDER_CANCELLATION") {
      console.log(
        "Routing cancelled order details :",
        engine_request.order,
        "with trades:",
        engine_request.trades
      );
      streamCancellationDetails(
        engine_request.action,
        engine_request.market,
        engine_request.cancelled_order
      );
    }
  }
}

export default RiskRouter;
