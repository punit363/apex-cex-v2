import RedisHandler from "./redis.js";
import { getRiskShardId } from "./utils/index.js";

const redis = await RedisHandler.createInstance();

const streamTradeDetails = async (market: string, order: any, trades: any) => {
  let net_qty = 0;
  let net_amt = 0;

  //orders already sitting in market
  trades.map(async (trade: any) => {
    net_amt += trade.price;
    net_qty += trade.quantity;

    const maker_trade = {
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
    };

    console.log("maker_trade", maker_trade, "maker_shard_id++++++++++++++++");
    const maker_shard_id = getRiskShardId(trade.otherUserId);
    await redis.addTradeUpdateToRiskCheckStream(maker_shard_id, maker_trade);
  });

  // order that came at last
  const taker_trade = {
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
  };

  console.log("taker_trade", taker_trade, "taker_shard_id++++++++++++++++");
  const taker_shard_id = getRiskShardId(order.user_id);
  await redis.addTradeUpdateToRiskCheckStream(taker_shard_id, taker_trade);

  //need side data BUY/SELL?
};

class RiskTradeRouter {
  public async routeTradeDetails(order_data: any, id: string) {
    console.log(
      "Routing trade details for order:",
      order_data.order,
      "with trades:",
      order_data.trades
    );
    streamTradeDetails(order_data.market, order_data.order, order_data.trades);
  }
}

export default RiskTradeRouter;
