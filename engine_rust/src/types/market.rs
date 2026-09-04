use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EngineResponseStatus {
    Success,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EngineResponse<T> {
    pub status: EngineResponseStatus,
    pub odb_status_code: u8,
    pub message: String,
    pub data: Option<T>,
}

impl<T> EngineResponse<T> {
    pub fn success(data: T, message: impl Into<String>) -> Self {
        Self {
            status: EngineResponseStatus::Success,
            odb_status_code: 0,
            message: message.into(),
            data: Some(data),
        }
    }

    pub fn failed(code: u8, message: impl Into<String>) -> Self {
        Self {
            status: EngineResponseStatus::Failed,
            odb_status_code: code,
            message: message.into(),
            data: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Candle {
    pub bucket_time: u64,
    pub quote_asset: String,
    pub base_asset: String,
    pub open: u64,
    pub close: u64,
    pub high: u64,
    pub low: u64,
    pub vol: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Market {
    pub base: String,
    pub quote: String,
}

impl Market {
    pub fn new(base: impl Into<String>, quote: impl Into<String>) -> Self {
        Self {
            base: base.into(),
            quote: quote.into(),
        }
    }

    /// Generates canonical stream key suffix or map key (e.g., "BTC_USDT").
    pub fn to_key(&self) -> String {
        format!("{}_{}", self.base, self.quote)
    }
}

//tells Rust how to format and print Market as a user-facing string
impl std::fmt::Display for Market {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}_{}", self.base, self.quote)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Ticker {
    pub market: String,
    pub price: u64,
    pub quantity: u64,
    pub trade_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct DepthMap {
    pub bids: BTreeMap<u64, u64>,
    pub asks: BTreeMap<u64, u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct OrderBookData {
    pub bids: BTreeMap<u64, u64>,
    pub asks: BTreeMap<u64, u64>,
    #[serde(rename = "currentPrice")]
    pub current_price: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct OrderBookSnapshot {
    pub market: String,
    pub orderbook_data: OrderBookData,
}