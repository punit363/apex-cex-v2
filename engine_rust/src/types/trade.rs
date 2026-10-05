use crate::types::order::{ OrderSide, OrderStatus, OrderType };
use serde::{ Deserialize, Serialize };

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Fill {
    pub price: u64,
    pub quantity: u64,
    pub user_id: String,
    pub other_user_id: String,
    pub trade_id: String,
    pub order_id: String,
    pub other_order_id: String,
    pub other_order_filled: u64,
    pub other_order_status: OrderStatus,
    pub bucket_time: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlacedOrderData {
    pub user_id: String,
    pub order_id: String,
    pub price: u64,
    pub quantity: u64,
    pub side: OrderSide,
    pub order_type: OrderType,
    pub base_asset: String,
    pub quote_asset: String,
    pub status: OrderStatus,
    pub filled: u64,
    pub unsold_market_order_quantity: u64,
    pub unused_market_order_amount: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TradeData {
    pub action: String,
    pub market: String,
    pub placed_order: PlacedOrderData,
    pub trades: Vec<Fill>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PublishTrade {
    pub market: String,
    pub trades: Vec<Fill>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CancellationEvent {
    pub action: String,
    pub market: String,
    pub order_id: String,
    pub user_id: String,
    pub side: OrderSide,
    pub quantity: u64,
    pub filled: u64,
    pub price: u64,
    pub base_asset: String,
    pub quote_asset: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchResult {
    pub order_id: String,
    pub fills: Vec<Fill>,
    pub status: OrderStatus,
    pub filled: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsold_market_order_quantity: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unused_market_order_amount: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserEvent {
    OrderRejected {
        order_id: String,
        reason: String,
    },
    CancelConfirmed {
        order_id: String,
        filled: f64,
        quantity: f64,
    },
    CancelRejected {
        order_id: String,
        reason: String,
    },
}
