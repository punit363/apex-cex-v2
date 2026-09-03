use std::collections::BTreeMap;

pub enum EngineResponseStatus {
    SUCCESS,
    FAILED,
}

pub struct EngineResponse<T> {
    status: EngineResponseStatus,
    odb_status_code: u8,
    message: String,
    data: Option<T>,
}

pub struct Candle {
    bucket_time: u64,
    quote_asset: String,
    base_asset: String,
    open: u64,
    close: u64,
    high: u64,
    low: u64,
    vol: u64,
}

pub struct Market {
    base: String,
    quote: String,
}

pub struct Ticker {
    market: String,
    price: u64,
    quantity: u64,
    trade_id: String,
}

pub struct DepthMap {
    pub bids: BTreeMap<u64, u64>,
    pub asks: BTreeMap<u64, u64>,
}

pub struct OrderBookData {
    bids: BTreeMap<u64, u64>,
    asks: BTreeMap<u64, u64>,
    current_price: u64,
}

pub struct OrderBookSnapshot {
    market: String,
    orderbook_data: OrderBookData,
}
