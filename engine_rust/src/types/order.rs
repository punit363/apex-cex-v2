pub enum OrderStatus {
    OPEN,
    FILLED,
    CANCELLED,
    PARTIAL,
}

pub enum OrderSide {
    BUY,
    SELL,
}

pub enum OrderType {
    MARKET,
    LIMIT,
}

pub struct Order {
    order_id: String,
    user_id: String,
    price: u64,
    quantity: u64,
    filled: u64,
    status: OrderStatus,
    side: OrderSide,
}

struct OrderRequestData {
    order_id: String,
    price: u64,
    quantity: u64,
    side: OrderSide,
    order_type: OrderType,
    base_asset: String,
    quote_asset: String,
}

pub struct OrderRequest {
    action: String,
    user_id: String,
    order_data: OrderRequestData,
}

struct OrderPublishData {
    order_id: String,
    user_id: String,
    side: OrderSide,
    order_type: OrderType,
    quantity: u64,
    filled_quantity: u64,
    price: u64,
    status: OrderStatus,
    base_asset: String,
    quote_asset: String,
    created_at: String, //ponder on it?
}

pub struct OrderPublish {
    market: String,
    order_data: OrderPublishData,
}

struct OrderCancelData {
    order_id: String,
    user_id: String,
    side: OrderSide,
    quantity: u64,
    filled_quantity: u64,
    price: u64,
    base_asset: String,
    quote_asset: String,
}

pub struct OrderCancellation {
    action: String,
    market: String,
    cancel_data: OrderCancelData,
}

pub struct IncommingOrder {
    order_id: String,
    price: u64,
    quantity: u64,
    side: OrderSide,
    order_type: OrderType,
}

