import fs from "fs";
import { Orderbook, Fills } from "./orderbook";
import RedisHandler from "./redis";
import { generateCandleId } from "./utils";
import { CONFIG } from "./config.js";

const SCALE = CONFIG.SCALE;
interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

let SUPPORTED_MARKETS = [
  { base: "BTC", quote: "USDT" },
  { base: "ETH", quote: "USDT" },
  { base: "SOL", quote: "USDT" },
  { base: "XRP", quote: "USDT" },
  { base: "DOGE", quote: "USDT" },
  { base: "ADA", quote: "USDT" },
  { base: "LINK", quote: "USDT" },
  { base: "MATIC", quote: "USDT" },
  { base: "BCH", quote: "USDT" },
  { base: "FIL", quote: "USDT" },
  { base: "BTC", quote: "USDC" },
  { base: "ETH", quote: "USDC" },
  { base: "SOL", quote: "USDC" },
  { base: "AVAX", quote: "USDC" },
  { base: "BTC", quote: "USD" },
  { base: "ETH", quote: "USD" },
  { base: "LTC", quote: "USD" },
  { base: "ETH", quote: "BTC" },
  { base: "SOL", quote: "BTC" },
  { base: "ADA", quote: "BTC" },
  { base: "XRP", quote: "BTC" },
  { base: "DOT", quote: "BTC" },
  { base: "LINK", quote: "BTC" },
  { base: "AVAX", quote: "BTC" },
  { base: "UNI", quote: "BTC" },
  { base: "SOL", quote: "ETH" },
  { base: "MATIC", quote: "ETH" },
  { base: "AAVE", quote: "ETH" },
  { base: "GRT", quote: "ETH" },
  { base: "DOT", quote: "ETH" },
];

const balance_arr: [string, UserBalance][] = [
  [
    "usr_7r6ej956isv",
    {
      USD: {
        available: 10000000000000,
        locked: 0,
      },
      BTC: {
        available: 1000000000000,
        locked: 0,
      },
    },
  ],
  [
    "usr_xslwr9hnet",
    {
      USD: {
        available: 20000000000000,
        locked: 0,
      },
      BTC: {
        available: 2000000000000,
        locked: 0,
      },
    },
  ],
];

let balance = new Map<string, UserBalance>(balance_arr);

const checkAndLockBalance = (
  user_id: any,
  quantity: number,
  price: number,
  side: string,
  quoteAsset: string,
  baseAsset: string
) => {
  const userBalance = balance.get(user_id);
  if (!userBalance) {
    throw new Error(
      `CRITICAL: Balance ledger completely missing for user: ${user_id}`
    );
  }

  if (side == "buy") {
    if (!userBalance[quoteAsset])
      throw new Error(
        `CRITICAL: ${quoteAsset} ledger missing for user: ${user_id}`
      );

    const quoteValue = Math.floor((quantity * price) / SCALE);

    if (userBalance[quoteAsset].available < quoteValue) {
      throw new Error("Insufficient balance for buy order");
    }

    userBalance[quoteAsset].available -= quoteValue;
    userBalance[quoteAsset].locked += quoteValue;
  } else if (side == "sell") {
    if (!userBalance[baseAsset])
      throw new Error(
        `CRITICAL: ${baseAsset} ledger missing for user: ${user_id}`
      );

    if (userBalance[baseAsset].available < quantity) {
      throw new Error("Insufficient balance for sell order");
    }

    userBalance[baseAsset].available -= quantity;
    userBalance[baseAsset].locked += quantity;
  }
};

const settleBalanceAfterTrade = (
  fills: Fills[],
  side: string,
  quoteAsset: string,
  baseAsset: string
) => {
  if (side === "sell") {
    for (const fill of fills) {
      const userBalance = balance.get(fill.userId);
      const otherUserBalance = balance.get(fill.otherUserId);

      if (!userBalance || !otherUserBalance) {
        throw new Error(`Balance missing for fill: ${JSON.stringify(fill)}`);
      }
      if (
        !userBalance[baseAsset] ||
        !userBalance[quoteAsset] ||
        !otherUserBalance[baseAsset] ||
        !otherUserBalance[quoteAsset]
      ) {
        throw new Error(
          `Specific asset ledger missing during settleBalanceAfterTrade`
        );
      }

      const quoteValue = Math.floor((fill.quantity * fill.price) / SCALE);

      userBalance[baseAsset].locked -= fill.quantity;
      userBalance[quoteAsset].available += quoteValue;

      otherUserBalance[quoteAsset].locked -= quoteValue;
      otherUserBalance[baseAsset].available += fill.quantity;
    }
  } else if (side === "buy") {
    for (const fill of fills) {
      const userBalance = balance.get(fill.userId);
      const otherUserBalance = balance.get(fill.otherUserId);

      if (!userBalance || !otherUserBalance) {
        throw new Error(`Balance missing for fill: ${JSON.stringify(fill)}`);
      }
      if (
        !userBalance[baseAsset] ||
        !userBalance[quoteAsset] ||
        !otherUserBalance[baseAsset] ||
        !otherUserBalance[quoteAsset]
      ) {
        throw new Error(
          `Specific asset ledger missing during settleBalanceAfterTrade`
        );
      }

      const quoteValue = Math.floor((fill.quantity * fill.price) / SCALE);

      userBalance[quoteAsset].locked -= quoteValue;
      userBalance[baseAsset].available += fill.quantity;

      otherUserBalance[baseAsset].locked -= fill.quantity;
      otherUserBalance[quoteAsset].available += quoteValue;
    }
  } else {
    throw new Error("Order side must be buy or sell");
  }
};

const settleBalanceAfterTradeCancellation = (
  userId: string,
  quantity: number,
  filled: number,
  price: number,
  side: string,
  quoteAsset: string,
  baseAsset: string
) => {
  const userBalance = balance.get(userId);

  if (!userBalance) {
    throw new Error(`Balance missing for user: ${JSON.stringify(userId)}`);
  }
  const remainingQty = quantity - filled;

  if (side === "sell") {
    if (!userBalance[baseAsset])
      throw new Error(
        `CRITICAL: ${baseAsset} ledger missing for user: ${userId}`
      );
    userBalance[baseAsset].locked -= remainingQty;
    userBalance[baseAsset].available += remainingQty;
  } else if (side === "buy") {
    if (!userBalance[quoteAsset])
      throw new Error(
        `CRITICAL: ${quoteAsset} ledger missing for user: ${userId}`
      );

    const remainingQuoteValue = Math.floor((remainingQty * price) / SCALE);

    userBalance[quoteAsset].locked -= remainingQuoteValue;
    userBalance[quoteAsset].available += remainingQuoteValue;
  } else {
    throw new Error("Order side must be buy or sell");
  }
};

type Candle = {
  bucket_time: number;
  quote_asset: string;
  base_asset: string;
  open: number;
  close: number;
  high: number;
  low: number;
  vol: number;
};

let activeCandles = new Map<string, Candle>();

const addCandlesToDB = async (
  fills: Fills[],
  baseAsset: string,
  quoteAsset: string
) => {
  const market = `${baseAsset}_${quoteAsset}`;
  let currentCandle = activeCandles.get(market);
  for (const fill of fills) {
    if (!currentCandle || currentCandle.bucket_time < fill.bucketTime) {
      if (currentCandle) {
        const redis = await RedisHandler.createInstance();
        await redis.sendToDB({
          action: "ADD_CANDLE",
          candle: {
            candle_id: generateCandleId(),
            interval: "1m",
            base_asset: baseAsset,
            quote_asset: quoteAsset,
            open: currentCandle.open,
            high: currentCandle.high,
            low: currentCandle.low,
            close: currentCandle.close,
            volume: currentCandle.vol,
          },
        });
      }
      currentCandle = {
        bucket_time: fill.bucketTime,
        quote_asset: quoteAsset,
        base_asset: baseAsset,
        open: fill.price,
        close: fill.price,
        high: fill.price,
        low: fill.price,
        vol: fill.quantity,
      };
    } else {
      currentCandle.low = Math.min(currentCandle.low, fill.price);
      currentCandle.high = Math.max(currentCandle.high, fill.price);
      currentCandle.close = fill.price;
      currentCandle.vol += fill.quantity;
    }
    activeCandles.set(market, currentCandle);
  }
};

type Transaction = {
  tx_id: string;
  user_id: string;
  asset: string;
  type: string;
  amount: number;
};

const addTransactionInDB = async (transaction: Transaction) => {
  const redis = await RedisHandler.createInstance();
  await redis.sendToDB({
    action: "ADD_TRANSACTION",
    transaction,
  });
};

class Engine {
  orderbooks: Orderbook[] = [];

  constructor() {
    try {
      const snapshot = fs.readFileSync("./snapshot.json", "utf-8");
      const parsed = JSON.parse(snapshot);

      this.orderbooks = parsed.orderbooks.map(
        (ob: any) =>
          new Orderbook(
            ob.baseAsset,
            ob.quoteAsset,
            ob.bids,
            ob.asks,
            ob.lastTradeId,
            ob.currentPrice
          )
      );

      balance = new Map<string, UserBalance>(parsed.balances);
      activeCandles = new Map<string, Candle>(parsed.candles);
    } catch {
      this.orderbooks = SUPPORTED_MARKETS.map(
        (m) => new Orderbook(m.base, m.quote, [], [], "", 0)
      );
      console.log("No snapshot found, starting fresh");
    }

    setInterval(() => {
      const currentSnapshot = {
        orderbooks: this.orderbooks.map((ob) => ({
          baseAsset: ob.baseAsset,
          quoteAsset: ob.quoteAsset,
          bids: ob.bids,
          asks: ob.asks,
          lastTradeId: ob.lastTradeId,
          currentPrice: ob.currentPrice,
        })),
        balances: Array.from(balance.entries()),
        activeCandles: Array.from(activeCandles.entries()),
      };

      fs.writeFileSync("./snapshot.json", JSON.stringify(currentSnapshot));
    }, 1000 * 3);
  }

  processOrderRequest = async (
    order: {
      action: string;
      user_id: string;
      order_data: {
        order_id?: any;
        price?: any;
        quantity?: any;
        side?: any;
        type?: any;
        baseAsset?: any;
        quoteAsset?: any;
      };
    },
    engine_request_id: string
  ) => {
    switch (order.action) {
      case "PLACE_ORDER": {
        const redis = await RedisHandler.createInstance();
        try {
          const { price, quantity, side, type, baseAsset, quoteAsset } =
            order.order_data;

          const isMarketSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === baseAsset && m.quote === quoteAsset
          );

          if (!isMarketSupported) {
            throw new Error(
              `Market pair ${baseAsset}_${quoteAsset} is not supported.`
            );
          }

          const orderbook = this.orderbooks.find(
            (o) =>
              o.baseAsset === order.order_data.baseAsset &&
              o.quoteAsset === order.order_data.quoteAsset
          );

          if (!orderbook) {
            throw new Error("No orderbook found");
          }

          checkAndLockBalance(
            order.user_id,
            quantity,
            price,
            side,
            quoteAsset,
            baseAsset
          );

          const {
            status: orderStatus,
            odb_status_code,
            message,
            data,
          } = orderbook.placeOrder(order.user_id, order.order_data);

          if (!data) {
            redis
              .sendApiResponse(
                {
                  eng_status_code: odb_status_code,
                  status: orderStatus,
                  message,
                  data: null,
                },
                engine_request_id
              )
              .catch((err) => {
                console.error(
                  `[Error] Failed to send placeOrder error response, engine_request_id: ${engine_request_id}, error:`,
                  err.message
                );
              });
            break;
          }

          const {
            order_id,
            fills,
            status,
            filled,
            unsold_market_order_quanity = null,
            unused_market_order_amount = null,
          } = data;

          settleBalanceAfterTrade(
            fills,
            order.order_data.side,
            order.order_data.quoteAsset,
            order.order_data.baseAsset
          );

          const response = {
            order_id,
            fills,
            unsold_market_order_quanity,
            unused_market_order_amount,
          };

          redis
            .sendApiResponse(
              {
                eng_status_code: odb_status_code,
                status: orderStatus,
                message,
                data: response,
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send placeOrder success response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                err.message
              );
            });

          const market = `${baseAsset}_${quoteAsset}`;
          const order_publish_data = {
            market,
            order: {
              order_id,
              user_id: order.user_id,
              side,
              type,
              quantity,
              filled_quantity: filled,
              price,
              status,
              base_asset: baseAsset,
              quote_asset: quoteAsset,
              created_at: new Date().toISOString(),
            },
          };

          redis.publishOrder(market, order_publish_data).catch((err) => {
            console.error(
              `[Error] Failed to publish order data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
              err.message
            );
          });

          const trade_publish_data = {
            market,
            trade: fills,
          };

          redis.publishTrade(market, trade_publish_data).catch((err) => {
            console.error(
              `[Error] Failed to publish trade data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
              err.message
            );
          });

          const book_with_quantity_publish_data = {
            market,
            book: orderbook.getBookWithQuantity(),
          };

          redis
            .publishOrderBookWithQuantity(
              market,
              book_with_quantity_publish_data
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to publish orderbook update, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                err.message
              );
            });

          orderbook.publishSnapshot();

          redis
            .sendToDB({
              action: "ADD_ORDER",
              order: {
                order_id,
                user_id: order.user_id,
                side,
                type,
                quantity,
                filled_quantity: filled,
                price,
                status,
                base_asset: baseAsset,
                quote_asset: quoteAsset,
              },
            })
            .catch((err) => {
              console.error(
                `[Error] Failed to sync ADD_ORDER, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                err.message
              );
            });

          if (fills.length > 0) {
            for (const fill of fills) {
              const ticker_trade = {
                market: `${baseAsset}_${quoteAsset}`,
                price: fill.price,
                quantity: fill.quantity,
                trade_id: fill.tradeId,
              };
              await redis.saveTickerData(
                `${baseAsset}_${quoteAsset}`,
                ticker_trade
              );
            }

            addCandlesToDB(fills, baseAsset, quoteAsset);

            const trades = fills.map((fill) => ({
              trade_id: fill.tradeId,
              user_id: fill.userId,
              other_user_id: fill.otherUserId,
              order_id: fill.orderId,
              other_order_id: fill.otherOrderId,
              price: fill.price,
              quantity: fill.quantity,
              base_asset: baseAsset,
              quote_asset: quoteAsset,
              side,
            }));

            redis
              .sendToDB({
                action: "ADD_TRADES",
                trades,
              })
              .catch((err) => {
                console.error(
                  `[Error] Failed to sync ADD_TRADES, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });

            const update_order = fills.map((fill) => ({
              order_id: fill.otherOrderId,
              filled: fill.otherOrderFilled,
              status: fill.otherOrderStatus,
            }));

            redis
              .sendToDB({
                action: "UPDATE_ORDERS",
                update_order,
              })
              .catch((err) => {
                console.error(
                  `[Error] Failed to sync UPDATE_ORDERS, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });
          }
        } catch (error: any) {
          console.error(
            "Engine ORDER_PROCESSING_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during trade execution.",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to dispatch order crash fallback, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
      case "CANCEL_ORDER": {
        const redis = await RedisHandler.createInstance();
        try {
          const user_id = order.user_id;
          const { order_id, baseAsset, quoteAsset, side } = order.order_data;

          const isMarketSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === baseAsset && m.quote === quoteAsset
          );

          if (!isMarketSupported) {
            throw new Error(
              `Market pair ${baseAsset}_${quoteAsset} is not supported.`
            );
          }

          const orderbook = this.orderbooks.find(
            (o) =>
              o.baseAsset === order.order_data.baseAsset &&
              o.quoteAsset === order.order_data.quoteAsset
          );

          if (!orderbook) {
            throw new Error(`No orderbook found for base asset: ${baseAsset}`);
          }

          const odb_response = orderbook.cancelOrder(user_id, order_id, side);
          //update balance
          if (odb_response.data) {
            odb_response.data.status = "cancelled";

            settleBalanceAfterTradeCancellation(
              user_id,
              odb_response.data.quantity,
              odb_response.data.filled,
              odb_response.data.price,
              odb_response.data.side,
              quoteAsset,
              baseAsset
            );

            const cancel_order = {
              order_id,
              status: odb_response.data.status,
            };

            redis
              .sendToDB({
                action: "CANCEL_ORDER",
                cancel_order,
              })
              .catch((err) => {
                console.error(
                  `[CRITICAL] Non-blocking Database Sync failed during Cancel Order, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });

            orderbook.publishSnapshot();
            redis
              .sendApiResponse(
                {
                  eng_status_code: 1,
                  status: "SUCCESS",
                  message: "Order was cancelled successfully",
                  data: odb_response.data,
                },
                engine_request_id
              )
              .catch((err) => {
                console.error(
                  `[Failed to transmit API gateway success response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });
          } else {
            redis
              .sendApiResponse(
                {
                  eng_status_code: odb_response.odb_status_code,
                  status: odb_response.status,
                  message: odb_response.message,
                  data: odb_response.data,
                },
                engine_request_id
              )
              .catch((err) => {
                console.error(
                  `[Failed to transmit API gateway fail response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });
          }
        } catch (error: any) {
          console.error(
            `Engine CANCEL_ORDER_ERROR Intercepted, engine_request_id: ${engine_request_id}, error:`,
            error.message
          );
          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message +
                    ` engine_request_id: ${engine_request_id}, error:` ||
                  `An unexpected error occurred during order cancellation, engine_request_id: ${engine_request_id}, error:`,
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                err.message +
                  ` engine_request_id: ${engine_request_id}, error:` ||
                  `Failed to transmit API gateway crash response, engine_request_id: ${engine_request_id}, error:`
              );
            });
        }
        break;
      }
      case "FETCH_ORDERS": {
        const redis = await RedisHandler.createInstance();
        try {
          const { baseAsset, quoteAsset } = order.order_data;

          const isMarketSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === baseAsset && m.quote === quoteAsset
          );

          if (!isMarketSupported) {
            throw new Error(
              `Market pair ${baseAsset}_${quoteAsset} is not supported.`
            );
          }

          const orderbook = this.orderbooks.find(
            (o) =>
              o.baseAsset === order.order_data.baseAsset &&
              o.quoteAsset === order.order_data.quoteAsset
          );

          if (!orderbook) {
            throw new Error("No orderbook found");
          }

          const response = orderbook.fetchOpenOrders();

          redis
            .sendApiResponse(
              {
                eng_status_code: 1,
                status: "SUCCESS",
                message: "Open Orders were fetched successfully",
                data: response,
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchOpenOrders success response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        } catch (error: any) {
          console.error(
            "Engine FETCH_OPEN_ORDERS_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during order fetch",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchOpenOrders crash response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
    }
  };

  processBalanceRequest = async (
    transaction: {
      action: string;
      user_id: string;
      transaction_data: {
        tx_id: string;
        asset: string;
        type: string;
        amount: number;
      };
    },
    engine_request_id: string
  ) => {
    switch (transaction.action) {
      case "UPDATE_BALANCE": {
        const redis = await RedisHandler.createInstance();
        try {
          const { tx_id, asset, type, amount } = transaction.transaction_data;
          const { user_id } = transaction;

          const isAssetSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === asset || m.quote === asset
          );

          if (!isAssetSupported) {
            throw new Error(`This asset : ${asset} is not supported.`);
          }

          const user_balance: UserBalance | any = balance.get(user_id);

          if (!user_balance) {
            throw new Error(`User balance not found for user_id: ${user_id}`);
          }

          if (!user_balance[asset]) {
            user_balance[asset] = { available: 0, locked: 0 };
          }

          if (type === "deposit") {
            user_balance[asset].available += amount;

            addTransactionInDB({
              tx_id,
              user_id,
              asset,
              type,
              amount,
            }).catch((err) => {
              console.error(
                `Non-Blocking DB Logging Error for tx ${tx_id}:`,
                err.message
              );
            });
          } else if (type === "withdraw") {
            if (user_balance[asset].available < amount) {
              throw new Error("You do not have sufficient balance");
            }

            user_balance[asset].available -= amount;

            addTransactionInDB({
              tx_id,
              user_id,
              asset,
              type,
              amount,
            }).catch((err) => {
              console.error(
                `Non-Blocking DB Logging Error for tx ${tx_id}:`,
                err.message
              );
            });
          } else {
            throw new Error(
              "Invalid transaction type or user balance does not exist"
            );
          }
          balance.set(user_id, user_balance);

          redis
            .sendApiResponse(
              {
                eng_status_code: 1,
                status: "SUCCESS",
                data: user_balance,
                message: "Balance updated successfully",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send updateBalance success response, engine_request_id: ${engine_request_id}, user_id: ${user_id}, error:`,
                err.message
              );
            });
        } catch (error: any) {
          console.error(
            "Engine BALANCE_UPDATE_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during balance adjustments.",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send updateBalance crash response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
      case "FETCH_BALANCE": {
        const redis = await RedisHandler.createInstance();
        try {
          const { user_id } = transaction;

          const user_balance = balance.get(user_id);

          if (!user_balance) {
            throw new Error(`User balance not found for user_id: ${user_id}`);
          }

          redis
            .sendApiResponse(
              {
                eng_status_code: 1,
                status: "SUCCESS",
                data: user_balance,
                message: "Balance fetched successfully",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchBalance success response, engine_request_id: ${engine_request_id}, user_id: ${user_id}, error:`,
                err.message
              );
            });
        } catch (error: any) {
          console.error(
            "Engine FETCH_BALANCE_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during balance fetch.",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchBalance crash response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
    }
  };

  processUserRequest = async (
    user: {
      user_id: string;
      asset?: string;
      amount?: number;
    },
    engine_request_id: string
  ) => {
    const redis = await RedisHandler.createInstance();
    try {
      const user_id = user.user_id;
      const asset = user.asset || SUPPORTED_MARKETS[0].base;
      const amount = user.amount || 0;

      if (!user_id) {
        throw new Error("User ID is required to add a user.");
      }

      const isAssetSupported = SUPPORTED_MARKETS.some(
        (m) => m.base === asset || m.quote === asset
      );

      if (!isAssetSupported) {
        throw new Error(`This asset : ${asset} is not supported.`);
      }

      const user_balance = balance.get(user_id);

      if (user_balance) {
        throw new Error(
          `User ${user_id} already exists in the balance ledger.`
        );
      }

      balance.set(user_id, {
        [asset]: {
          available: amount,
          locked: 0,
        },
      });

      redis
        .sendApiResponse(
          {
            eng_status_code: 1,
            status: "SUCCESS",
            message: "User successfully added to balance ledger",
          },
          engine_request_id
        )
        .catch((err) => {
          console.error(
            `[Error] Failed to send addUser success response, engine_request_id: ${engine_request_id}, user_id: ${user_id}, error:`,
            err.message
          );
        });
    } catch (error: any) {
      console.error(
        `Engine ADD_USER_ERROR Intercepted, engine_request_id: ${engine_request_id}, error:`,
        error.message
      );

      redis
        .sendApiResponse(
          {
            eng_status_code: 0,
            status: "FAILED",
            message:
              error.message ||
              "An unexpected error occurred during user creation",
          },
          engine_request_id
        )
        .catch((err) => {
          console.error(
            `[Error] Failed to send addUser crash response, engine_request_id: ${engine_request_id}, error:`,
            err.message
          );
        });
    }
  };

  processMarketRequest = async (
    market: {
      user_id?: string;
      action: string;
    },
    engine_request_id: string
  ) => {
    switch (market.action) {
      case "FETCH_ALL_MARKETS": {
        const redis = await RedisHandler.createInstance();
        try {
          const allMarkets = this.orderbooks
            .map((ob) => ({
              baseAsset: ob.baseAsset,
              quoteAsset: ob.quoteAsset,
              currentPrice: ob.currentPrice,
            }))
            .sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));

          if (allMarkets.length === 0) {
            throw new Error("No market data available");
          }

          redis
            .sendApiResponse(
              {
                eng_status_code: 1,
                status: "SUCCESS",
                data: allMarkets,
                message: "All market data fetched successfully",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchAllMarkets success response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        } catch (error: any) {
          console.error(
            "Engine FETCH_ALL_MARKETS_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during market fetch.",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchAllMarkets crash response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
      case "FETCH_ALL_ASSET": {
        const redis = await RedisHandler.createInstance();
        try {
          const allAssets = Array.from(
            new Set(SUPPORTED_MARKETS.flatMap((m) => [m.base, m.quote]))
          );

          if (allAssets.length === 0) {
            throw new Error("No asset data available");
          }

          redis
            .sendApiResponse(
              {
                eng_status_code: 1,
                status: "SUCCESS",
                data: allAssets,
                message: "All asset data fetched successfully",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchAllAssets success response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        } catch (error: any) {
          console.error(
            "Engine FETCH_ALL_ASSETS_ERROR Intercepted: ",
            error.message
          );

          redis
            .sendApiResponse(
              {
                eng_status_code: 0,
                status: "FAILED",
                message:
                  error.message ||
                  "An unexpected error occurred during asset fetch.",
              },
              engine_request_id
            )
            .catch((err) => {
              console.error(
                `[Error] Failed to send fetchAllAssets crash response, engine_request_id: ${engine_request_id}, error:`,
                err.message
              );
            });
        }
        break;
      }
    }
  };
}

export default Engine;
