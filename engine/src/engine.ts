import fs from "fs";
import { Fills, Orderbook } from "./orderbook";
import RedisHandler from "./redis";
import { CONFIG } from "./config.js";
import { generateCandleId } from "./utils";

const SCALE = CONFIG.SCALE;

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
        redis
          .sendToDB({
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
          })
          .catch((err) => {
            console.error(`[Error] Failed to sync ADD_CANDLE`, err.message);
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

class Engine {
  orderbooks: Orderbook[] = [];

  constructor() {
    try {
      const snapshot = fs.readFileSync("./snapshot.json", "utf-8");
      const parsed = JSON.parse(snapshot);

      this.orderbooks = parsed.orderbooks.map(
        (ob: any) =>
          new Orderbook(
            ob.base_asset,
            ob.quote_asset,
            ob.bids,
            ob.asks,
            ob.lastTradeId,
            ob.currentPrice
          )
      );
    } catch {
      this.orderbooks = SUPPORTED_MARKETS.map(
        (m) => new Orderbook(m.base, m.quote, [], [], "", 0)
      );
      console.log("No snapshot found, starting fresh");
    }

    setInterval(() => {
      const currentSnapshot = {
        orderbooks: this.orderbooks.map((ob) => ({
          base_asset: ob.baseAsset,
          quote_asset: ob.quoteAsset,
          bids: ob.bids,
          asks: ob.asks,
          lastTradeId: ob.lastTradeId,
          currentPrice: ob.currentPrice,
        })),
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
        base_asset?: any;
        quote_asset?: any;
      };
    },
    engine_request_id: string
  ) => {
    switch (order.action) {
      case "PLACE_ORDER": {
        const redis = await RedisHandler.createInstance();
        try {
          console.log("order reached engine", order);
          order.order_data.price = Number(order.order_data.price);
          order.order_data.quantity = Number(order.order_data.quantity);
          const { price, quantity, side, type, base_asset, quote_asset } =
            order.order_data;

          const isMarketSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === base_asset && m.quote === quote_asset
          );

          if (!isMarketSupported) {
            throw new Error(
              `Market pair ${base_asset}_${quote_asset} is not supported.`
            );
          }

          const orderbook = this.orderbooks.find(
            (o) =>
              o.baseAsset === order.order_data.base_asset &&
              o.quoteAsset === order.order_data.quote_asset
          );

          if (!orderbook) {
            throw new Error("No orderbook found");
          }
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
            unsold_market_order_quanity = 0,
            unused_market_order_amount = 0,
          } = data;

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

          const market = `${base_asset}_${quote_asset}`;
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
              base_asset: base_asset,
              quote_asset: quote_asset,
              created_at: new Date().toISOString(),
            },
          };

          redis.publishOrder(market, order_publish_data).catch((err) => {
            console.error(
              `[Error] Failed to publish order data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
              err.message
            );
          });

          //Don't publish just trade, publish order and its respective trades, so that the client can update the order and trades in one go
          const trade_data = {
            action: "TRADE_EXECUTED",
            market,
            placed_order: {
              user_id: order.user_id,
              order_id,
              price,
              quantity,
              side,
              type,
              base_asset,
              quote_asset,
              status,
              filled,
              unsold_market_order_quanity,
              unused_market_order_amount,
            },
            trades: fills,
          };

          redis.addTradeToRiskRouterStream(market, trade_data).catch((err) => {
            console.error(
              `[Error] Failed to publish trade data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
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
                base_asset: base_asset,
                quote_asset: quote_asset,
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
                market: `${base_asset}_${quote_asset}`,
                price: fill.price,
                quantity: fill.quantity,
                trade_id: fill.tradeId,
              };
              redis
                .saveTickerData(`${base_asset}_${quote_asset}`, ticker_trade)
                .catch((err) => {
                  console.error(
                    `[Error] Failed to sync save ticker data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                    err.message
                  );
                });
            }

            addCandlesToDB(fills, base_asset, quote_asset);

            const trades = fills.map((fill) => ({
              trade_id: fill.tradeId,
              user_id: fill.userId,
              other_user_id: fill.otherUserId,
              order_id: fill.orderId,
              other_order_id: fill.otherOrderId,
              price: fill.price,
              quantity: fill.quantity,
              base_asset: base_asset,
              quote_asset: quote_asset,
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
          const { order_id, base_asset, quote_asset, side } = order.order_data;

          const isMarketSupported = SUPPORTED_MARKETS.some(
            (m) => m.base === base_asset && m.quote === quote_asset
          );

          if (!isMarketSupported) {
            throw new Error(
              `Market pair ${base_asset}_${quote_asset} is not supported.`
            );
          }

          const orderbook = this.orderbooks.find(
            (o) =>
              o.baseAsset === order.order_data.base_asset &&
              o.quoteAsset === order.order_data.quote_asset
          );

          if (!orderbook) {
            throw new Error(`No orderbook found for base asset: ${base_asset}`);
          }

          const odb_response = orderbook.cancelOrder(user_id, order_id, side);

          if (odb_response.data) {
            odb_response.data.status = "cancelled";

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

            const market = `${base_asset}_${quote_asset}`;

            const cancellation_data = {
              action: "ORDER_CANCELLATION",
              market,
              cancelled_order: {
                order_id,
                user_id: order.user_id,
                side: odb_response.data.side,
                quantity: odb_response.data.quantity,
                filled: odb_response.data.filled,
                price: odb_response.data.price,
                base_asset,
                quote_asset,
              },
            };

            redis
              .addTradeToRiskRouterStream(market, cancellation_data)
              .catch((err) => {
                console.error(
                  `[Failed to transmit API gateway success response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                  err.message
                );
              });
          } else {
            console.log("++++++++++", {
              eng_status_code: odb_response.odb_status_code,
              status: odb_response.status,
              message: odb_response.message,
              data: odb_response.data,
            });
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
    }
  };
}

export default Engine;
