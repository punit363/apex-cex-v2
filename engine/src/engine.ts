import fs from "fs";
import { Orderbook } from "./orderbook";
import {
  Fill,
  Market,
  OrderCancellation,
  OrderPublishData,
  Ticker,
  TradeData,
} from "./types/type";
import RedisHandler from "./redis";
import { CONFIG } from "./config.js";
import { generateCandleId } from "./utils";
import { Candle, OrderRequest } from "./types/type";

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

const SNAPSHOT_PATH = "./snapshot.json";
const SNAPSHOT_INTERVAL_MS = 3000;
const CANDLE_INTERVAL = "1m";

let activeCandles = new Map<string, Candle>();

const addCandlesToDB = async (
  fills: Fill[],
  base_asset: string,
  quote_asset: string
) => {
  const market = `${base_asset}_${quote_asset}`;
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
              base_asset: base_asset,
              quote_asset: quote_asset,
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
        quote_asset: quote_asset,
        base_asset: base_asset,
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
  private readonly orderbooks: Map<string, Orderbook>;
  private readonly activeCandles: Map<string, Candle> = new Map();
  private readonly redis: RedisHandler;

  constructor(redis: RedisHandler) {
    this.redis = redis;
    this.orderbooks = this.loadOrderbooks();
    this.startSnapshotLoop();
  }

  static async create(): Promise<Engine> {
    const redis = await RedisHandler.createInstance();
    return new Engine(redis);
  }

  private loadOrderbooks(): Map<string, Orderbook> {
    const map = new Map<string, Orderbook>();
    try {
      const snapshot = fs.readFileSync(SNAPSHOT_PATH, "utf-8");
      const parsed = JSON.parse(snapshot);
      for (const ob of parsed.orderbooks) {
        const key = this.marketKey(ob.base_asset, ob.quote_asset);
        map.set(
          key,
          new Orderbook(
            ob.base_asset,
            ob.quote_asset,
            ob.bids,
            ob.asks,
            ob.lastTradeId,
            ob.currentPrice
          )
        );
      }
      console.log(`Loaded ${map.size} orderbooks from snapshot`);
    } catch {
      for (const m of SUPPORTED_MARKETS) {
        const key = this.marketKey(m.base, m.quote);
        map.set(key, new Orderbook(m.base, m.quote, [], [], "", 0));
      }
      console.log("No snapshot found, starting fresh");
    }
    return map;
  }

  private startSnapshotLoop(): void {
    setInterval(() => {
      this.writeSnapshot();
    }, SNAPSHOT_INTERVAL_MS);
  }

  private writeSnapshot(): void {
    try {
      const snapshot = {
        orderbooks: Array.from(this.orderbooks.values()).map((ob) => ({
          base_asset: ob.base_asset,
          quote_asset: ob.quote_asset,
          bids: ob.bids,
          asks: ob.asks,
          lastTradeId: ob.lastTradeId,
          currentPrice: ob.currentPrice,
        })),
      };
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
    } catch (err: any) {
      // Snapshot failure is non-fatal but worth knowing about
      console.error("[Snapshot] Failed to write snapshot:", err.message);
    }
  }

  private marketKey(base: string, quote: string): string {
    return `${base}_${quote}`;
  }

  private getOrderbook(
    base_asset: string,
    quote_asset: string
  ): Orderbook | null {
    return this.orderbooks.get(this.marketKey(base_asset, quote_asset)) ?? null;
  }

  private async handlePlaceOrder(
    order: OrderRequest,
    engine_request_id: string
  ): Promise<void> {
    try {
      console.log("order reached engine", order);
      order.order_data.price = Number(order.order_data.price);
      order.order_data.quantity = Number(order.order_data.quantity);
      const { price, quantity, side, type, base_asset, quote_asset } =
        order.order_data;

      const isMarketSupported = SUPPORTED_MARKETS.some(
        (m: Market) => m.base === base_asset && m.quote === quote_asset
      );

      if (!isMarketSupported) {
        throw new Error(
          `Market ${base_asset}_${quote_asset} is not supported.`
        );
      }

      const orderbook = this.getOrderbook(base_asset, quote_asset);

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
        // pubsub req for orderbook not found
        return;
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

      // redis
      //   .sendApiResponse(
      //     {
      //       eng_status_code: odb_status_code,
      //       status: orderStatus,
      //       message,
      //       data: response,
      //     },
      //     engine_request_id
      //   )
      //   .catch((err) => {
      //     console.error(
      //       `[Error] Failed to send placeOrder success response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
      //       err.message
      //     );
      //   });

      const market = `${base_asset}_${quote_asset}`;
      const order_publish_data: OrderPublishData = {
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

      this.redis.publishOrder(market, order_publish_data).catch((err) => {
        console.error(
          `[Error] Failed to publish order data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
          err.message
        );
      });

      //Don't publish just trade, publish order and its respective trades, so that the client can update the order and trades in one go
      const trade_data: TradeData = {
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

      this.redis.addTradeToRiskRouterStream(market, trade_data).catch((err) => {
        console.error(
          `[Error] Failed to publish trade data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
          err.message
        );
      });

      const trade_publish_data: { market: string; trade: Fill[] } = {
        market,
        trade: fills,
      };

      this.redis.publishTrade(market, trade_publish_data).catch((err) => {
        console.error(
          `[Error] Failed to publish trade data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
          err.message
        );
      });

      const book_with_quantity_publish_data: {
        market: string;
        book: {
          bids: { [price: number]: number };
          asks: { [price: number]: number };
        };
      } = {
        market,
        book: orderbook.getBookWithQuantity(),
      };

      this.redis
        .publishOrderBookWithQuantity(market, book_with_quantity_publish_data)
        .catch((err) => {
          console.error(
            `[Error] Failed to publish orderbook update, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
            err.message
          );
        });

      orderbook.publishSnapshot();

      this.redis
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
          const ticker_trade: Ticker = {
            market: `${base_asset}_${quote_asset}`,
            price: fill.price,
            quantity: fill.quantity,
            trade_id: fill.tradeId,
          };
          this.redis
            .saveTickerData(`${base_asset}_${quote_asset}`, ticker_trade)
            .catch((err) => {
              console.error(
                `[Error] Failed to sync save ticker data, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
                err.message
              );
            });
        }

        addCandlesToDB(fills, base_asset, quote_asset);

        const trades = fills.map((fill: any) => ({
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

        this.redis
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

        const update_order = fills.map((fill: Fill) => ({
          order_id: fill.otherOrderId,
          filled: fill.otherOrderFilled,
          status: fill.otherOrderStatus,
        }));

        this.redis
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

      // redis
      //   .sendApiResponse(
      //     {
      //       eng_status_code: 0,
      //       status: "FAILED",
      //       message:
      //         error.message ||
      //         "An unexpected error occurred during trade execution.",
      //     },
      //     engine_request_id
      //   )
      //   .catch((err) => {
      //     console.error(
      //       `[Error] Failed to dispatch order crash fallback, engine_request_id: ${engine_request_id}, error:`,
      //       err.message
      //     );
      //   });
    }
  }

  private handleCancelOrder = (
    order: OrderRequest,
    engine_request_id: string
  ) => {
    try {
      const user_id = order.user_id;
      const { order_id, base_asset, quote_asset, side } = order.order_data;

      const isMarketSupported = SUPPORTED_MARKETS.some(
        (m: Market) => m.base === base_asset && m.quote === quote_asset
      );

      if (!isMarketSupported) {
        throw new Error(
          `Market pair ${base_asset}_${quote_asset} is not supported.`
        );
      }

      const orderbook = this.getOrderbook(base_asset, quote_asset);

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

        this.redis
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

        const cancellation_data: OrderCancellation = {
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

        this.redis
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
        // redis
        //   .sendApiResponse(
        //     {
        //       eng_status_code: odb_response.odb_status_code,
        //       status: odb_response.status,
        //       message: odb_response.message,
        //       data: odb_response.data,
        //     },
        //     engine_request_id
        //   )
        //   .catch((err) => {
        //     console.error(
        //       `[Failed to transmit API gateway fail response, engine_request_id: ${engine_request_id}, order_id: ${order_id}, error:`,
        //       err.message
        //     );
        //   });
      }
    } catch (error: any) {
      console.error(
        `Engine CANCEL_ORDER_ERROR Intercepted, engine_request_id: ${engine_request_id}, error:`,
        error.message
      );
      // redis
      //   .sendApiResponse(
      //     {
      //       eng_status_code: 0,
      //       status: "FAILED",
      //       message:
      //         error.message +
      //           ` engine_request_id: ${engine_request_id}, error:` ||
      //         `An unexpected error occurred during order cancellation, engine_request_id: ${engine_request_id}, error:`,
      //     },
      //     engine_request_id
      //   )
      //   .catch((err) => {
      //     console.error(
      //       err.message +
      //         ` engine_request_id: ${engine_request_id}, error:` ||
      //         `Failed to transmit API gateway crash response, engine_request_id: ${engine_request_id}, error:`
      //     );
      //   });
    }
  };

  processOrderRequest = async (
    order: OrderRequest,
    engine_request_id: string
  ) => {
    const redis = await RedisHandler.createInstance();
    switch (order.action) {
      case "PLACE_ORDER": {
        await this.handlePlaceOrder(order, engine_request_id);
        break;
      }
      case "CANCEL_ORDER": {
        await this.handleCancelOrder(order, engine_request_id);
        break;
      }
    }
  };
}

export default Engine;
