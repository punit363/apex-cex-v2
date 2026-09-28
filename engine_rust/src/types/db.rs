use crate::types::order::{ OrderSide, OrderStatus, OrderType };
use serde::{ Serialize, Deserialize };

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AddOrderPayload {
    pub order_id: String,
    pub user_id: String,
    pub side: OrderSide,
    #[serde(rename = "type")]
    pub order_type: OrderType,
    pub quantity: u64,
    pub filled_quantity: u64,
    pub price: u64,
    pub status: OrderStatus,
    pub base_asset: String,
    pub quote_asset: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UpdateOrderPayload {
    order_id: String,
    filled: u64,
    status: OrderStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CancelOrderPayload {
    order_id: String,
    status: OrderStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
struct Trades {
    trade_id: String,
    user_id: String,
    other_user_id: String,
    order_id: String,
    other_order_id: String,
    price: u64,
    quantity: u64,
    base_asset: String,
    quote_asset: String,
    side: OrderSide,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
struct AddTradePayload {
    trades: Vec<Trades>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
struct AddCandlePayload {
    candle_id: String,
    interval: String,
    base_asset: String,
    quote_asset: String,
    open: u64,
    high: u64,
    low: u64,
    close: u64,
    volume: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(tag = "action", content = "data")]
pub enum DbRequest {
    #[serde(rename = "ADD_ORDER")] AddOrder(AddOrderPayload),

    #[serde(rename = "UPDATE_ORDERS")] UpdateOrder(UpdateOrderPayload),

    #[serde(rename = "CANCEL_ORDER")] CancelOrder(CancelOrderPayload),

    #[serde(rename = "ADD_TRADES")] AddTrade(AddTradePayload),

    #[serde(rename = "ADD_CANDLE")] AddCandle(AddCandlePayload),
}
