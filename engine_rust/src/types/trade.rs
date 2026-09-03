use crate::types::order::OrderStatus;


pub struct Fill {
    price: u64,
    quantity: u64,
    user_id: String,
    other_user_id: String,
    trade_id: String,
    order_id: String,
    other_order_id: String,
    other_order_filled: u64,
    other_order_status: OrderStatus,
    bucket_time: u64,
}

pub struct PlacedOrderData {
    user_id: String,
    order_id: String,
    price: u64,
    quantity: u64,
    side: String,
    order_type: String,
    base_asset: String,
    quote_asset: String,
    status: String,
    filled: u64,
    unsold_market_order_quantity: u64,
    unused_market_order_amount: u64,
}

pub struct TradeData {
    action: String,
    market: String,
    placed_order: PlacedOrderData,
    trades: Vec<Fill>,
}

pub struct MatchResult {
    order_id: String,
    fills: Vec<Fill>,
    status: OrderStatus,
    filled: u64,
    unsold_market_order_quantity: Option<u64>,
    unused_market_order_amount: Option<u64>,
}


