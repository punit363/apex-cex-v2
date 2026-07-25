import RedisHandler from "./redis";
import { generateTradeId } from "./utils";
import { CONFIG } from "./config.js";

const SCALE = CONFIG.SCALE
export interface Order {
  orderId: string;
  userID: string;
  price: number;
  quantity: number;
  filled: number;
  status: "open" | "filled" | "cancelled" | "partial";
  side: "buy" | "sell";
}

export interface Fills {
  price: number;
  quantity: number;
  userId: string;
  otherUserId: string;
  tradeId: string;
  orderId: string;
  otherOrderId: string;
  otherOrderFilled: number;
  otherOrderStatus: string;
  bucketTime: number;
}

export interface EngineResponse<T> {
  status: "SUCCESS" | "FAILED";
  odb_status_code: number;
  message: string;
  data: T | null;
}

export interface MatchResult {
  order_id: string;
  fills: Fills[];
  status: string;
  filled: number;
  unsold_market_order_quanity?: number | null;
  unused_market_order_amount?: number | null;
}

export class Orderbook {
  baseAsset: string;
  quoteAsset: string;
  bids: Order[];
  asks: Order[];
  lastTradeId: string;
  currentPrice: number;

  bookWithQuantity: {
    bids: { [price: number]: number };
    asks: { [price: number]: number };
  } = {
    bids: {},
    asks: {},
  };

  constructor(
    baseAsset: string,
    quoteAsset: string,
    bids: Order[],
    asks: Order[],
    lastTradeId: string,
    currentPrice: number
  ) {
    this.baseAsset = baseAsset;
    this.quoteAsset = quoteAsset;
    this.bids = bids;
    this.asks = asks;
    this.lastTradeId = lastTradeId;
    this.currentPrice = currentPrice;

    this.rebuildDepthCache();
  }

  private rebuildDepthCache() {
    this.bookWithQuantity.bids = {};
    this.bookWithQuantity.asks = {};
    for (const bid of this.bids) {
      this.bookWithQuantity.bids[bid.price] =
        (this.bookWithQuantity.bids[bid.price] || 0) +
        (bid.quantity - bid.filled);
    }
    for (const ask of this.asks) {
      this.bookWithQuantity.asks[ask.price] =
        (this.bookWithQuantity.asks[ask.price] || 0) +
        (ask.quantity - ask.filled);
    }
  }

  updateCurrentPrice = (fills: Fills[]) => {
    if (fills.length > 0) {
      this.currentPrice = fills[fills.length - 1].price;
    }
  };

  updateLastTradeId = (fills: Fills[]) => {
    if (fills.length > 0) {
      this.lastTradeId = fills[fills.length - 1].tradeId;
    }
  };

  getBucketTime = () => {
    const tradeTime = new Date().getTime();
    const bucketTime = tradeTime - (tradeTime % 60000);
    return bucketTime;
  };

  getBookWithQuantity = () => {
    return this.bookWithQuantity;
  };

  publishSnapshot = async () => {
    try {
      const market = `${this.baseAsset}_${this.quoteAsset}`;
      const payload = {
        bids: this.bookWithQuantity.bids,
        asks: this.bookWithQuantity.asks,
        currentPrice: this.currentPrice,
      };
    
      const redis = await RedisHandler.createInstance();
      redis.setBookWithQuantity(market, payload);
    } catch (error) {
      console.error("Failed to push book snapshot to Redis:", error);
    }
  };

  private executeSellOrder = (
    user_id: string,
    order_data: {
      order_id?: any;
      price?: any;
      quantity?: any;
      side?: any;
      type?: any;
      filled?: any;
      status?: any;
    }
  ): MatchResult => {
    let {
      order_id,
      price,
      quantity,
      type,
      filled = 0,
      status = "open",
    } = order_data;
    const fills: Fills[] = [];
    let unsold_market_order_quanity: number | null = null;
    const bid_splice_indexes: number[] = [];

    for (const o of this.bids) {
      if (price <= o.price || type === "market") {
        const fillQuantity = Math.min(quantity - filled, o.quantity - o.filled);
        o.filled += fillQuantity;

        if (o.filled === o.quantity) {
          o.status = "filled";
        } else if (o.filled > 0) {
          o.status = "partial";
        }

        this.bookWithQuantity.bids[o.price] =
          (this.bookWithQuantity.bids[o.price] || 0) - fillQuantity;

        const tradeId = generateTradeId();
        fills.push({
          price: o.price,
          quantity: fillQuantity,
          tradeId,
          userId: user_id,
          otherUserId: o.userID,
          orderId: order_id,
          otherOrderId: o.orderId,
          otherOrderFilled: o.filled,
          otherOrderStatus: o.status,
          bucketTime: this.getBucketTime(),
        });

        filled += fillQuantity;

        if (o.quantity === o.filled) {
          bid_splice_indexes.push(this.bids.indexOf(o));
        }
      }

      if (this.bookWithQuantity.bids[o.price] <= 0) {
        delete this.bookWithQuantity.bids[o.price];
      }

      if (filled === quantity) {
        status = "filled";
        break;
      }
    }

    if (type === "limit") {
      const odr: Order = {
        price,
        quantity,
        filled,
        status:
          filled === 0 ? "open" : filled < quantity ? "partial" : "filled",
        orderId: order_id,
        side: "sell",
        userID: user_id,
      };

      if (filled < quantity) {
        const index = this.asks.findIndex((el: Order) => el.price > odr.price);
        if (index === -1) {
          this.asks.push(odr);
        } else {
          this.asks.splice(index, 0, odr);
        }

        this.bookWithQuantity.asks[price] =
          (this.bookWithQuantity.asks[price] || 0) + quantity - filled;
      }
    } else if (quantity !== filled && type === "market") {
      unsold_market_order_quanity = quantity - filled;
    }

    this.bids = this.bids.filter((_, idx) => !bid_splice_indexes.includes(idx));

    return {
      order_id,
      fills,
      status: filled === 0 ? "open" : filled < quantity ? "partial" : "filled",
      filled,
      unsold_market_order_quanity,
    };
  };

  private executeBuyOrder = (
    user_id: string,
    order_data: {
      order_id?: any;
      price?: any;
      quantity?: any;
      side?: any;
      type?: any;
      filled?: number;
      status?: any;
    }
  ): MatchResult => {
    let { order_id, price, quantity, type, filled = 0, status } = order_data;

    const fills: Fills[] = [];
    let unused_market_order_amount: number | null = null;
    const ask_splice_indexes: number[] = [];
   
    for (const o of this.asks) {
      if (type === "market") {
        const affordableBase = Math.floor((price * SCALE) / o.price);
        const availableBase = o.quantity - o.filled;
        const fillQuantity = Math.min(affordableBase, availableBase);

        if (fillQuantity <= 0) break;

        o.filled += fillQuantity;
        if (o.filled === o.quantity) {
          o.status = "filled";
        } else if (o.filled > 0) {
          o.status = "partial";
        }
        this.bookWithQuantity.asks[o.price] =
          (this.bookWithQuantity.asks[o.price] || 0) - fillQuantity;
       
        const tradeId = generateTradeId();
        fills.push({
          price: o.price,
          quantity: fillQuantity,
          tradeId,
          userId: user_id,
          otherUserId: o.userID,
          orderId: order_id,
          otherOrderId: o.orderId,
          otherOrderFilled: o.filled,
          otherOrderStatus: o.status,
          bucketTime: this.getBucketTime(),
        });

        filled += fillQuantity;
        price -= Math.floor((fillQuantity * o.price) / SCALE);

        if (o.quantity === o.filled) {
          ask_splice_indexes.push(this.asks.indexOf(o));
        }
      }

      if (price >= o.price && type === "limit") {
        const fillQuantity = Math.min(quantity - filled, o.quantity - o.filled);
        o.filled += fillQuantity;
        if (o.filled === o.quantity) {
          o.status = "filled";
        } else if (o.filled > 0) {
          o.status = "partial";
        }

        this.bookWithQuantity.asks[o.price] =
          (this.bookWithQuantity.asks[o.price] || 0) - fillQuantity;

        const tradeId = generateTradeId();
        fills.push({
          price: o.price,
          quantity: fillQuantity,
          tradeId,
          userId: user_id,
          otherUserId: o.userID,
          orderId: order_id,
          otherOrderId: o.orderId,
          otherOrderFilled: o.filled,
          otherOrderStatus: o.status,
          bucketTime: this.getBucketTime(),
        });
        filled += fillQuantity;

        if (o.quantity === o.filled) {
          ask_splice_indexes.push(this.asks.indexOf(o));
        }
      }

      if (this.bookWithQuantity.asks[o.price] <= 0) {
        delete this.bookWithQuantity.asks[o.price];
      }

      if (type === "limit" && quantity === filled) {
        break;
      }

      if (type === "market" && price <= 0) {
        break;
      }
    }

    if (quantity !== filled && type === "limit") {
      const odr: Order = {
        price,
        quantity,
        orderId: order_id,
        side: "buy",
        filled,
        status: filled === 0 ? "open" : "partial",
        userID: user_id,
      };

      const index = this.bids.findIndex((el: Order) => el.price < odr.price);
      if (index === -1) {
        this.bids.push(odr);
      } else {
        this.bids.splice(index, 0, odr);
      }

      this.bookWithQuantity.bids[price] =
        (this.bookWithQuantity.bids[price] || 0) + quantity - filled;
    }

    if (price !== 0 && type === "market") {
      unused_market_order_amount = price;
    }

    this.asks = this.asks.filter((_, idx) => !ask_splice_indexes.includes(idx));

    if (type === "limit") {
      if (filled === quantity) {
        status = "filled";
      } else {
        status = "partial";
      }
    } else if (type === "market") {
      if (price > 0) {
        status = "partial";
      } else {
        status = "filled";
      }
    }

    return {
      order_id,
      fills,
      status,
      filled,
      unused_market_order_amount,
    };
  };

  placeOrder = (
    user_id: string,
    order_data: {
      order_id?: any;
      price?: any;
      quantity?: any;
      side?: any;
      type?: any;
    }
  ): EngineResponse<MatchResult> => {
    const { side, quantity, price, type } = order_data;

    if (!user_id) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Rejected: missing authorized user token context.",
        data: null,
      };
    }

    if (type === "limit" && (!price || price <= 0)) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message:
          "Rejected: Limit orders require execution price greater than zero.",
        data: null,
      };
    }

    if (quantity <= 0 && !(type === "market" && side === "buy")) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Rejected: execution quantity must be greater than zero.",
        data: null,
      };
    }

    try {
      if (side === "sell") {
        const result = this.executeSellOrder(user_id, order_data);
        this.updateCurrentPrice(result.fills);
        this.updateLastTradeId(result.fills);
        return {
          status: "SUCCESS",
          odb_status_code: 1,
          message: "Sell order processed successfully",
          data: result,
        };
      } else if (side === "buy") {
        const result = this.executeBuyOrder(user_id, order_data);
        this.updateCurrentPrice(result.fills);
        this.updateLastTradeId(result.fills);
        return {
          status: "SUCCESS",
          odb_status_code: 1,
          message: "Buy order processed successfully",
          data: result,
        };
      } else {
        return {
          status: "FAILED",
          odb_status_code: 0,
          message: `Rejected: invalid trade side dimension '${side}'.`,
          data: null,
        };
      }
    } catch (err: any) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: `Engine Match Error: ${
          err.message || "Execution exception occurred"
        }`,
        data: null,
      };
    }
  };

  fetchOpenOrders = () => {
    return { asks: this.asks, bids: this.bids };
  };

  cancelOrder = (
    user_id: string,
    order_id: string,
    side: string
  ): EngineResponse<Order> => {
    const normalizedSide = side.toLowerCase();

    const bookList = normalizedSide === "sell" ? this.asks : this.bids;
    const depthMap =
      normalizedSide === "sell"
        ? this.bookWithQuantity.asks
        : this.bookWithQuantity.bids;

    const idx = bookList.findIndex(
      (o) => o.orderId === order_id && o.userID === user_id
    );

    if (idx === -1) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Order not found in active order books",
        data: null,
      };
    }

    const orderToCancel = bookList[idx];

    if (orderToCancel.filled === orderToCancel.quantity) {
      return {
        status: "FAILED",
        odb_status_code: 0,
        message: "Cancellation rejected. Order is already completely filled.",
        data: null,
      };
    }

    const remainingQty = orderToCancel.quantity - orderToCancel.filled;
    if (depthMap[orderToCancel.price] !== undefined) {
      depthMap[orderToCancel.price] -= remainingQty;

      if (depthMap[orderToCancel.price] <= 0) {
        delete depthMap[orderToCancel.price];
      }
    }

    bookList.splice(idx, 1);

    return {
      status: "SUCCESS",
      odb_status_code: 1,
      message: "Order cancelled successfully",
      data: orderToCancel,
    };
  };
}
