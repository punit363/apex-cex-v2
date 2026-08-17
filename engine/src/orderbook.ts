import RedisHandler from "./redis.js";
import { generateTradeId } from "./utils/index.js";
import { CONFIG } from "./config.js";
import {
  EngineResponse,
  Fill,
  MatchResult,
  Order,
  Side,
  Status,
  IncomingOrder,
  DepthMap,
  OrderBookSnapshot,
} from "./types/type.js";

const SCALE = CONFIG.SCALE;

export class Orderbook {
  readonly base_asset: string;
  readonly quote_asset: string;
  bids: Order[];
  asks: Order[];
  lastTradeId: string;
  currentPrice: number;

  private bookWithQuantity: DepthMap = { bids: {}, asks: {} };

  constructor(
    base_asset: string,
    quote_asset: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: string,
    currentPrice: number,
  ) {
    this.base_asset = base_asset;
    this.quote_asset = quote_asset;
    this.lastTradeId = lastTradeId;
    this.currentPrice = currentPrice;

    this.bids = (bids ?? []).map(this.normalizeOrder);
    this.asks = (asks ?? []).map(this.normalizeOrder);

    this.rebuildDepthCache();
  }

  private normalizeOrder = (o: Order): Order => ({
    ...o,
    price: Number(o.price),
    quantity: Number(o.quantity),
    filled: Number(o.filled ?? 0),
  });

  private rebuildDepthCache(): void {
    this.bookWithQuantity = { bids: {}, asks: {} };
    for (const bid of this.bids) {
      this.bookWithQuantity.bids[bid.price] =
        (this.bookWithQuantity.bids[bid.price] ?? 0) +
        (bid.quantity - bid.filled);
    }
    for (const ask of this.asks) {
      this.bookWithQuantity.asks[ask.price] =
        (this.bookWithQuantity.asks[ask.price] ?? 0) +
        (ask.quantity - ask.filled);
    }
  }

  private marketKey(): string {
    return `${this.base_asset}_${this.quote_asset}`;
  }

  private getBucketTime(): number {
    const now = Date.now();
    return now - (now % 60_000);
  }

  private updateDepth(
    map: Record<number, number>,
    price: number,
    delta: number
  ): void {
    map[price] = (map[price] ?? 0) + delta;
    if (map[price] <= 0) delete map[price];
  }

  private orderStatus(filled: number, quantity: number): Status {
    if (filled === 0) return "OPEN";
    if (filled >= quantity) return "FILLED";
    return "PARTIAL";
  }

  public getBookWithQuantity(): OrderBookSnapshot {
    const market = this.marketKey();
    const orderbook_data = {
      bids: { ...this.bookWithQuantity.bids },
      asks: { ...this.bookWithQuantity.asks },
      currentPrice: this.currentPrice,
    };
    return { market, orderbook_data };
  }

  fetchOpenOrders(): { asks: Order[]; bids: Order[] } {
    return {
      asks: [...this.asks],
      bids: [...this.bids],
    };
  }

  private executeSellOrder(user_id: string, order: IncomingOrder): MatchResult {
    const { order_id, price, quantity, type } = order;
    let filled = order.filled ?? 0;
    const fills: Fill[] = [];
    const toRemove: number[] = []; 
    const bucketTime = this.getBucketTime(); 

    for (let i = 0; i < this.bids.length; i++) {
      const bid = this.bids[i];

      const priceMatches = type === "MARKET" || price <= bid.price;
      if (!priceMatches) continue;

      const fillQty = Math.min(quantity - filled, bid.quantity - bid.filled);
      if (fillQty <= 0) continue;

      bid.filled += fillQty;
      bid.status = this.orderStatus(bid.filled, bid.quantity);

      this.updateDepth(this.bookWithQuantity.bids, bid.price, -fillQty);

      fills.push({
        price: bid.price,
        quantity: fillQty,
        tradeId: generateTradeId(),
        userId: user_id,
        otherUserId: bid.userID,
        orderId: order_id,
        otherOrderId: bid.orderId,
        otherOrderFilled: bid.filled,
        otherOrderStatus: bid.status,
        bucketTime,
      });

      filled += fillQty;

      if (bid.filled >= bid.quantity) {
        toRemove.push(i);
      }

      if (filled >= quantity) break;
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bids.splice(toRemove[i], 1);
    }

    const status = this.orderStatus(filled, quantity);
    const unsold_market_order_quantity =
      type === "MARKET" ? quantity - filled : 0;

    if (type === "LIMIT" && filled < quantity) {
      const restingOrder: Order = {
        price,
        quantity,
        filled,
        status,
        orderId: order_id,
        side: "SELL",
        userID: user_id,
      };

      const insertAt = this.asks.findIndex((a) => a.price > price);
      if (insertAt === -1) {
        this.asks.push(restingOrder);
      } else {
        this.asks.splice(insertAt, 0, restingOrder);
      }
      this.updateDepth(this.bookWithQuantity.asks, price, quantity - filled);
    }

    return { order_id, fills, status, filled, unsold_market_order_quantity };
  }

  private executeBuyOrder(user_id: string, order: IncomingOrder): MatchResult {
    const { order_id, type } = order;
    let { price, quantity } = order;
    let filled = order.filled ?? 0;
    const fills: Fill[] = [];
    const toRemove: number[] = [];
    const bucketTime = this.getBucketTime();

    for (let i = 0; i < this.asks.length; i++) {
      const ask = this.asks[i];

      if (type === "LIMIT") {
        if (price < ask.price) break;

        const fillQty = Math.min(quantity - filled, ask.quantity - ask.filled);
        if (fillQty <= 0) continue;

        ask.filled += fillQty;
        ask.status = this.orderStatus(ask.filled, ask.quantity);
        this.updateDepth(this.bookWithQuantity.asks, ask.price, -fillQty);

        fills.push({
          price: ask.price,
          quantity: fillQty,
          tradeId: generateTradeId(),
          userId: user_id,
          otherUserId: ask.userID,
          orderId: order_id,
          otherOrderId: ask.orderId,
          otherOrderFilled: ask.filled,
          otherOrderStatus: ask.status,
          bucketTime,
        });

        filled += fillQty;
        if (ask.filled >= ask.quantity) toRemove.push(i);
        if (filled >= quantity) break;
      } else {
        const affordableBase = Math.floor((price * SCALE) / ask.price);
        const availableBase = ask.quantity - ask.filled;
        const fillQty = Math.min(affordableBase, availableBase);

        if (fillQty <= 0) break;

        ask.filled += fillQty;
        ask.status = this.orderStatus(ask.filled, ask.quantity);
        this.updateDepth(this.bookWithQuantity.asks, ask.price, -fillQty);

        fills.push({
          price: ask.price,
          quantity: fillQty,
          tradeId: generateTradeId(),
          userId: user_id,
          otherUserId: ask.userID,
          orderId: order_id,
          otherOrderId: ask.orderId,
          otherOrderFilled: ask.filled,
          otherOrderStatus: ask.status,
          bucketTime,
        });

        filled += fillQty;
        price -= Math.floor((fillQty * ask.price) / SCALE);

        if (ask.filled >= ask.quantity) toRemove.push(i);
        if (price <= 0) break;
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.asks.splice(toRemove[i], 1);
    }

    if (type === "LIMIT" && filled < quantity) {
      const restingOrder: Order = {
        price: order.price, 
        quantity,
        filled,
        status: this.orderStatus(filled, quantity),
        orderId: order_id,
        side: "BUY",
        userID: user_id,
      };
      const insertAt = this.bids.findIndex((b) => b.price < order.price);
      if (insertAt === -1) {
        this.bids.push(restingOrder);
      } else {
        this.bids.splice(insertAt, 0, restingOrder);
      }
      this.updateDepth(
        this.bookWithQuantity.bids,
        order.price,
        quantity - filled
      );
    }

    const unused_market_order_amount = type === "MARKET" ? price : 0;
    const status =
      type === "LIMIT"
        ? this.orderStatus(filled, quantity)
        : price > 0
        ? "PARTIAL"
        : "FILLED";

    return { order_id, fills, status, filled, unused_market_order_amount };
  }

  placeOrder(
    user_id: string,
    order_data: IncomingOrder
  ): EngineResponse<MatchResult> {
    const { side, quantity, price, type } = order_data;

    if (!user_id) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Rejected: missing authorized user token context.",
        data: null,
      };
    }

    if (type === "LIMIT" && (!price || price <= 0)) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Rejected: limit orders require a price greater than zero.",
        data: null,
      };
    }

    if (type !== "MARKET" || side !== "BUY") {
      if (quantity <= 0) {
        return {
          status: "FAILED",
          odb_status_code: 0,
          message: "Rejected: quantity must be greater than zero.",
          data: null,
        };
      }
    }

    try {
      const execute =
        side === "SELL" ? this.executeSellOrder : this.executeBuyOrder;
      const result = execute.call(this, user_id, order_data);

      if (result.fills.length > 0) {
        this.currentPrice = result.fills[result.fills.length - 1].price;
        this.lastTradeId = result.fills[result.fills.length - 1].tradeId;
      }

      return {
        status: "SUCCESS",
        odb_status_code: 1,
        message: `${side} order processed successfully`,
        data: result,
      };
    } catch (err: any) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: `Engine match error: ${err.message ?? "unexpected exception"}`,
        data: null,
      };
    }
  }

  cancelOrder(
    user_id: string,
    order_id: string,
    side: string
  ): EngineResponse<Order> {
    const normalizedSide = side.toUpperCase() as Side;
    const bookList = normalizedSide === "SELL" ? this.asks : this.bids;
    const depthMap =
      normalizedSide === "SELL"
        ? this.bookWithQuantity.asks
        : this.bookWithQuantity.bids;

    const idx = bookList.findIndex(
      (o) => o.orderId === order_id && o.userID === user_id
    );

    if (idx === -1) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Order not found in active order book.",
        data: null,
      };
    }

    const order = bookList[idx];

    if (order.filled >= order.quantity) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Cancellation rejected: order is already completely filled.",
        data: null,
      };
    }

    const remainingQty = order.quantity - order.filled;
    this.updateDepth(depthMap, order.price, -remainingQty);
    bookList.splice(idx, 1);

    return {
      status: "SUCCESS",
      odb_status_code: 1,
      message: "Order cancelled successfully.",
      data: order,
    };
  }
}
