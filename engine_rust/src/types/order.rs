use serde::{ Deserialize, Serialize };

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderStatus {
    Open,
    Partial,
    Filled,
    Cancelled,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderSide {
    Buy,
    Sell,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OrderType {
    Market,
    Limit,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Order {
    pub order_id: String,
    pub user_id: String,
    pub price: u64,
    pub quantity: u64,
    pub filled: u64,
    pub status: OrderStatus,
    pub side: OrderSide,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct OrderRequestData {
    pub order_id: String,
    pub price: u64,
    pub quantity: u64,
    pub side: OrderSide,
    #[serde(rename = "type")]
    pub order_type: OrderType,
    pub base_asset: String,
    pub quote_asset: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderRequest {
    pub action: String,
    pub user_id: String,
    pub order_data: OrderRequestData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct OrderPublishData {
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
    pub created_at: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderPublish {
    pub market: String,
    pub order_data: OrderPublishData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
struct OrderCancelData {
    pub order_id: String,
    pub user_id: String,
    pub side: OrderSide,
    pub quantity: u64,
    pub filled_quantity: u64,
    pub price: u64,
    pub base_asset: String,
    pub quote_asset: String,
}

pub struct OrderCancellation {
    pub action: String,
    pub market: String,
    pub cancel_data: OrderCancelData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IncommingOrder {
    pub order_id: String,
    pub price: u64,
    pub quantity: u64,
    pub side: OrderSide,
    #[serde(rename = "type")]
    pub order_type: OrderType,
}
