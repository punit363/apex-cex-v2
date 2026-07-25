import { verifyConnection } from "./client.js";
import RedisHandler from "./redis.js";
import { BalanceLedgerRepo } from "./repositories/balance.repo.js";
import { CandleRepo } from "./repositories/candle.repo.js";
import { OrderRepo } from "./repositories/order.repo.js";
import { TradeRepo } from "./repositories/trade.repo.js";
import { TransactionRepo } from "./repositories/transaction.repo.js";
import {
  Balance,
  Candle,
  Order,
  Trade,
  Transaction,
  User,
} from "./types/types.js";
import { generateBalanceLedgerId } from "./utils/index.js";

const dbMain = async () => {
  await verifyConnection();
  const redis = await RedisHandler.createInstance();
  while (true) {
    const response = await redis.getTradeDetail();

    if (response) {
      const db_data: {
        action: string;
        order?: Order;
        update_order?: any;
        cancel_order?: any;
        trades?: Trade[];
        transaction?: Transaction;
        balance?: Balance;
        user?: User;
        candle?: Candle;
      } = JSON.parse(response.element);

      switch (db_data.action) {
        case "ADD_ORDER": {
          const order_data = db_data.order;
          if (order_data) {
            await OrderRepo.create(order_data);
          } else {
            throw Error("Order Data not Found");
          }
          break;
        }
        case "UPDATE_ORDERS": {
          const update_data = db_data.update_order;
          if (update_data) {
            for (const update of update_data) {
              await OrderRepo.updateFilledAndStatus(update);
            }
          } else {
            throw Error("Order Update Data not Found");
          }
          break;
        }
        case "CANCEL_ORDER": {
          const cancel_order = db_data.cancel_order;
          if (cancel_order) {
            await OrderRepo.cancelOrder(cancel_order);
          } else {
            throw Error("Order Update Data not Found");
          }
          break;
        }
        case "ADD_TRADES": {
          const trade_data = db_data.trades;
          if (trade_data) {
            for (const trade of trade_data) {
              await TradeRepo.create(trade);

              if (trade.side === "buy") {
                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.user_id,
                  asset: trade.base_asset,
                  amount: trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.user_id,
                  asset: trade.quote_asset,
                  amount: -trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.other_user_id,
                  asset: trade.base_asset,
                  amount: -trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.other_user_id,
                  asset: trade.quote_asset,
                  amount: trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });
              } else if (trade.side === "sell") {
                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.user_id,
                  asset: trade.base_asset,
                  amount: -trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.user_id,
                  asset: trade.quote_asset,
                  amount: trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.other_user_id,
                  asset: trade.base_asset,
                  amount: trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });

                await BalanceLedgerRepo.create({
                  id: generateBalanceLedgerId(),
                  user_id: trade.other_user_id,
                  asset: trade.quote_asset,
                  amount: -trade.quantity,
                  type: "trade_fill",
                  ref_id: trade.trade_id,
                });
              }
            }
          } else {
            throw Error("Trade Data not Found");
          }
          break;
        }
        case "ADD_CANDLE": {
          const candle_data = db_data.candle;
          if (candle_data) {
            await CandleRepo.create(candle_data);
          } else {
            throw Error("Trade Data not Found");
          }
          break;
        }
        case "ADD_TRANSACTION": {
          const transaction_data = db_data.transaction;

          if (transaction_data) {
            await TransactionRepo.create(transaction_data);
            await BalanceLedgerRepo.create({
              id: generateBalanceLedgerId(),
              user_id: transaction_data.user_id,
              asset: transaction_data.asset,
              amount:
                transaction_data.type === "deposit"
                  ? transaction_data.amount
                  : -transaction_data.amount,
              type: "transaction",
              ref_id: transaction_data.tx_id,
            });
          } else {
            throw Error("Trade Data not Found");
          }
          break;
        }
      }
    }
  }
};

dbMain();
