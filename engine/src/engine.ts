import fs from "fs";
import { Orderbook } from "./orderbook.js";
import {
  Fill,
  Market,
  OrderCancellation,
  OrderPublishData,
  Ticker,
  TradeData,
  OrderRequest,
  Candle,
  PlaceOrderResult,
} from "./types/type.js";
import RedisHandler from "./redis.js";
import { CONFIG } from "./config.js";
import { generateCandleId } from "./utils/index.js";

const SCALE = CONFIG.SCALE;

const SUPPORTED_MARKETS: Market[] = [
  { base: "BTC", quote: "USDT" },
  { base: "ETH", quote: "USDT" },
  // ... rest of your markets
];

const SNAPSHOT_PATH = "./snapshot.json";
const SNAPSHOT_INTERVAL_MS = 3000;
const CANDLE_INTERVAL = "1m";

class Engine {
  private readonly orderbooks: Map<string, Orderbook>;
  private readonly activeCandles: Map<string, Candle> = new Map();
  private readonly redis: RedisHandler;

  // Redis is injected — not created per-request
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

  private publishSnapshot(orderbook: Orderbook): void {
    const { market, orderbook_data } = orderbook.getBookWithQuantity();
    this.redis
      .setBookWithQuantity(market, orderbook_data)
      .catch((err) =>
        console.error(
          `[Orderbook] Failed to push snapshot for ${market}:`,
          err.message
        )
      );
  }

  processOrderRequest = async (
    order: OrderRequest,
    engine_request_id: string
  ): Promise<void> => {
    switch (order.action) {
      case "PLACE_ORDER":
        await this.handlePlaceOrder(order, engine_request_id);
        break;
      case "CANCEL_ORDER":
        await this.handleCancelOrder(order, engine_request_id);
        break;
      default:
        console.warn(
          `[Engine] Unknown action received, engine_request_id: ${engine_request_id}`
        );
    }
  };

  private handlePlaceOrder = async (
    order: OrderRequest,
    engine_request_id: string
  ): Promise<void> => {
    try {
      const price = Number(order.order_data.price);
      const quantity = Number(order.order_data.quantity);
      const { side, type, base_asset, quote_asset } = order.order_data;
      const market = this.marketKey(base_asset, quote_asset);

      const orderbook = this.getOrderbook(base_asset, quote_asset);
      if (!orderbook) {
        await this.sendErrorResponse(
          engine_request_id,
          `Market ${market} is not supported.`
        );
        return;
      }

      const {
        status: orderStatus,
        odb_status_code,
        message,
        data,
      } = orderbook.placeOrder(order.user_id, {
        ...order.order_data,
      });

      if (!data) {
        //PUBSUB response
        // await this.redis.sendApiResponse(
        //   { eng_status_code: odb_status_code, status: orderStatus, message, data: null },
        //   engine_request_id
        // );
        return;
      }

      const {
        order_id,
        fills,
        status,
        filled,
        unsold_market_order_quantity = 0,
        unused_market_order_amount = 0,
      } = data as PlaceOrderResult;

      // PubSUB response
      // await this.redis.sendApiResponse(
      //   {
      //     eng_status_code: odb_status_code,
      //     status: orderStatus,
      //     message,
      //     data: { order_id, fills, unsold_market_order_quantity, unused_market_order_amount },
      //   },
      //   engine_request_id
      // );

      this.publishOrderUpdate(
        market,
        order,
        order_id,
        side,
        type,
        price,
        quantity,
        filled,
        status,
        base_asset,
        quote_asset
      );
      this.publishOrderBookDepth(market, orderbook);

      this.publishSnapshot(orderbook);

      await this.publishTradeData(
        market,
        order,
        order_id,
        fills,
        side,
        type,
        price,
        quantity,
        base_asset,
        quote_asset,
        status,
        filled,
        unsold_market_order_quantity,
        unused_market_order_amount,
        engine_request_id
      );

      this.syncOrderToDB(
        order,
        order_id,
        side,
        type,
        price,
        quantity,
        filled,
        status,
        base_asset,
        quote_asset,
        fills,
        engine_request_id
      );
    } catch (err: any) {
      console.error(
        `[Engine] PLACE_ORDER error, engine_request_id: ${engine_request_id}:`,
        err.message
      );
      await this.sendErrorResponse(engine_request_id, err.message);
    }
  };

  private handleCancelOrder = async (
    order: OrderRequest,
    engine_request_id: string
  ): Promise<void> => {
    try {
      const { order_id, base_asset, quote_asset, side } = order.order_data;
      const market = this.marketKey(base_asset, quote_asset);

      const orderbook = this.getOrderbook(base_asset, quote_asset);
      if (!orderbook) {
        await this.sendErrorResponse(
          engine_request_id,
          `Market ${market} is not supported.`
        );
        return;
      }

      const odb_response = orderbook.cancelOrder(order.user_id, order_id, side);

      if (!odb_response.data) {
        // Cancel rejected by order book (order not found, wrong user, already filled)
        // PubSub response
        // await this.redis.sendApiResponse(
        //   {
        //     eng_status_code: odb_response.odb_status_code,
        //     status: odb_response.status,
        //     message: odb_response.message,
        //     data: null,
        //   },
        //   engine_request_id
        // );
        return;
      }

      odb_response.data.status = "CANCELLED";

      this.redis
        .sendToDB({
          action: "CANCEL_ORDER",
          cancel_order: { order_id, status: "cancelled" },
        })
        .catch((err) =>
          console.error(
            `[CRITICAL] CANCEL_ORDER DB sync failed, engine_request_id: ${engine_request_id}, order_id: ${order_id}:`,
            err.message
          )
        );

      this.publishSnapshot(orderbook);

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

      await this.redis.addTradeToRiskRouterStream(market, cancellation_data);
    } catch (err: any) {
      console.error(
        `[Engine] CANCEL_ORDER error, engine_request_id: ${engine_request_id}:`,
        err.message
      );
      await this.sendErrorResponse(engine_request_id, err.message);
    }
  };

  private publishOrderUpdate(
    market: string,
    order: OrderRequest,
    order_id: string,
    side: string,
    type: string,
    price: number,
    quantity: number,
    filled: number,
    status: string,
    base_asset: string,
    quote_asset: string
  ): void {
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
        base_asset,
        quote_asset,
        created_at: new Date().toISOString(),
      },
    };

    this.redis
      .publishOrder(market, order_publish_data)
      .catch((err) =>
        console.error(
          `[Engine] publishOrder failed, order_id: ${order_id}:`,
          err.message
        )
      );
  }

  private publishOrderBookDepth(market: string, orderbook: Orderbook): void {
    this.redis
      .publishOrderBookWithQuantity(market, {
        market,
        book: orderbook.getBookWithQuantity(),
      })
      .catch((err) =>
        console.error(
          `[Engine] publishOrderBookWithQuantity failed, market: ${market}:`,
          err.message
        )
      );
  }

  private async publishTradeData(
    market: string,
    order: OrderRequest,
    order_id: string,
    fills: Fill[],
    side: string,
    type: string,
    price: number,
    quantity: number,
    base_asset: string,
    quote_asset: string,
    status: string,
    filled: number,
    unsold_market_order_quantity: number,
    unused_market_order_amount: number,
    engine_request_id: string
  ): Promise<void> {
    if (fills.length === 0) return;

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
        unsold_market_order_quantity,
        unused_market_order_amount,
      },
      trades: fills,
    };

    await this.redis
      .addTradeToRiskRouterStream(market, trade_data)
      .catch((err) =>
        console.error(
          `[CRITICAL] addTradeToRiskRouterStream failed, engine_request_id: ${engine_request_id}, order_id: ${order_id}:`,
          err.message
        )
      );

    this.redis
      .publishTrade(market, { market, trade: fills })
      .catch((err) =>
        console.error(
          `[Engine] publishTrade failed, order_id: ${order_id}:`,
          err.message
        )
      );
  }

  private syncOrderToDB(
    order: OrderRequest,
    order_id: string,
    side: string,
    type: string,
    price: number,
    quantity: number,
    filled: number,
    status: string,
    base_asset: string,
    quote_asset: string,
    fills: Fill[],
    engine_request_id: string
  ): void {
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
          base_asset,
          quote_asset,
        },
      })
      .catch((err) =>
        console.error(
          `[CRITICAL] ADD_ORDER DB sync failed, engine_request_id: ${engine_request_id}, order_id: ${order_id}:`,
          err.message
        )
      );

    if (fills.length === 0) return;

    this.syncTradesToDB(
      fills,
      base_asset,
      quote_asset,
      side,
      order_id,
      engine_request_id
    );
    this.syncTickerAndCandles(fills, base_asset, quote_asset, order_id);
  }

  private syncTradesToDB(
    fills: Fill[],
    base_asset: string,
    quote_asset: string,
    side: string,
    order_id: string,
    engine_request_id: string
  ): void {
    const trades = fills.map((fill) => ({
      trade_id: fill.tradeId,
      user_id: fill.userId,
      other_user_id: fill.otherUserId,
      order_id: fill.orderId,
      other_order_id: fill.otherOrderId,
      price: fill.price,
      quantity: fill.quantity,
      base_asset,
      quote_asset,
      side,
    }));

    this.redis
      .sendToDB({ action: "ADD_TRADES", trades })
      .catch((err) =>
        console.error(
          `[CRITICAL] ADD_TRADES DB sync failed, engine_request_id: ${engine_request_id}, order_id: ${order_id}:`,
          err.message
        )
      );

    const update_order = fills.map((fill) => ({
      order_id: fill.otherOrderId,
      filled: fill.otherOrderFilled,
      status: fill.otherOrderStatus,
    }));

    this.redis
      .sendToDB({ action: "UPDATE_ORDERS", update_order })
      .catch((err) =>
        console.error(
          `[CRITICAL] UPDATE_ORDERS DB sync failed, engine_request_id: ${engine_request_id}, order_id: ${order_id}:`,
          err.message
        )
      );
  }

  private syncTickerAndCandles(
    fills: Fill[],
    base_asset: string,
    quote_asset: string,
    order_id: string
  ): void {
    for (const fill of fills) {
      this.redis
        .saveTickerData(`${base_asset}_${quote_asset}`, {
          market: `${base_asset}_${quote_asset}`,
          price: fill.price,
          quantity: fill.quantity,
          trade_id: fill.tradeId,
        } satisfies Ticker)
        .catch((err) =>
          console.error(
            `[Engine] saveTickerData failed, order_id: ${order_id}:`,
            err.message
          )
        );
    }

    this.updateCandles(fills, base_asset, quote_asset, order_id);
  }

  private updateCandles(
    fills: Fill[],
    base_asset: string,
    quote_asset: string,
    order_id: string
  ): void {
    const market = this.marketKey(base_asset, quote_asset);

    for (const fill of fills) {
      let candle = this.activeCandles.get(market);

      if (!candle || candle.bucket_time < fill.bucketTime) {
        if (candle) {
          this.redis
            .sendToDB({
              action: "ADD_CANDLE",
              candle: {
                candle_id: generateCandleId(),
                interval: CANDLE_INTERVAL,
                base_asset,
                quote_asset,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.vol,
              },
            })
            .catch((err) =>
              console.error(
                `[Engine] ADD_CANDLE DB sync failed, order_id: ${order_id}:`,
                err.message
              )
            );
        }

        candle = {
          bucket_time: fill.bucketTime,
          quote_asset,
          base_asset,
          open: fill.price,
          close: fill.price,
          high: fill.price,
          low: fill.price,
          vol: fill.quantity,
        };
      } else {
        candle.low = Math.min(candle.low, fill.price);
        candle.high = Math.max(candle.high, fill.price);
        candle.close = fill.price;
        candle.vol += fill.quantity;
      }

      this.activeCandles.set(market, candle);
    }
  }

  private async sendErrorResponse(
    engine_request_id: string,
    message: string
  ): Promise<void> {
    //Pubsub response
    // await this.redis
    //   .sendApiResponse(
    //     { eng_status_code: 0, status: "FAILED", message, data: null },
    //     engine_request_id
    //   )
    //   .catch((err) =>
    //     console.error(
    //       `[Engine] Failed to send error response, engine_request_id: ${engine_request_id}:`,
    //       err.message
    //     )
    //   );
  }
}

export default Engine;
