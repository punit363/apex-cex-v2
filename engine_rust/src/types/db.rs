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
pub struct UpdateOrder {
    pub order_id: String,
    pub filled: u64,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UpdateOrderPayload {
    pub update_orders: Vec<UpdateOrder>,
}


#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct CancelOrderPayload {
    pub order_id: String,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TradeRecord {
    pub trade_id: String,
    pub user_id: String,
    pub other_user_id: String,
    pub order_id: String,
    pub other_order_id: String,
    pub price: u64,
    pub quantity: u64,
    pub base_asset: String,
    pub quote_asset: String,
    pub side: OrderSide,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AddTradePayload {
    pub trades: Vec<TradeRecord>,
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
