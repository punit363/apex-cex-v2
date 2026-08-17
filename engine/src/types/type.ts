interface Order {
  orderId: string;
  userID: string;
  price: number;
  quantity: number;
  filled: number;
  status: "open" | "filled" | "cancelled" | "partial";
  side: "BUY" | "SELL";
}

interface Fill {
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

interface EngineResponse<T> {
  status: "SUCCESS" | "FAILED";
  odb_status_code: number;
  message: string;
  data: T | null;
}

interface MatchResult {
  order_id: string;
  fills: Fill[];
  status: string;
  filled: number;
  unsold_market_order_quanity?: number;
  unused_market_order_amount?: number;
}

interface OrderRequest {
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
}

interface Candle {
  bucket_time: number;
  quote_asset: string;
  base_asset: string;
  open: number;
  close: number;
  high: number;
  low: number;
  vol: number;
}

interface Market {
  base: string;
  quote: string;
}

interface OrderPublishData {
  market: string;
  order: {
    order_id: string;
    user_id: string;
    side: string;
    type: string;
    quantity: number;
    filled_quantity: number;
    price: number;
    status: string;
    base_asset: string;
    quote_asset: string;
    created_at: string;
  };
}

interface TradeData {
  action: string;
  market: string;
  placed_order: {
    user_id: string;
    order_id: string;
    price: number;
    quantity: number;
    side: string;
    type: string;
    base_asset: string;
    quote_asset: string;
    status: string;
    filled: number;
    unsold_market_order_quanity: number;
    unused_market_order_amount: number;
  };
  trades: Fill[];
}

interface Ticker {
  market: string;
  price: number;
  quantity: number;
  trade_id: string;
}

interface OrderCancellation {
  action: string;
  market: string;
  cancelled_order: {
    order_id: string;
    user_id: string;
    side: string;
    quantity: number;
    filled: number;
    price: number;
    base_asset: string;
    quote_asset: string;
  };
}

export {
  OrderRequest,
  Candle,
  Order,
  Fill,
  EngineResponse,
  MatchResult,
  Market,
  OrderPublishData,
  TradeData,
  Ticker,
  OrderCancellation,
};
