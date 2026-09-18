use crate::{ orderbook::depth::DepthMap, types::{ order::Order } };

pub mod depth;
pub mod matching;

#[derive(Debug, PartialEq)]
pub struct Orderbook {
    pub quote_asset: String,
    pub base_asset: String,
    pub bids: Vec<Order>,
    pub asks: Vec<Order>,
    pub last_trade_id: String,
    pub current_price: u64,
    depth: DepthMap,
}

impl Orderbook {
    pub fn new(
        base_asset: String,
        quote_asset: String,
        mut bids: Vec<Order>,
        mut asks: Vec<Order>,
        last_trade_id: String,
        current_price: u64
    ) -> Self {
        // Normalize incoming orders: retain only orders with unfulfilled quantity
        for order in bids.iter_mut().chain(asks.iter_mut()) {
            if order.filled > order.quantity {
                order.filled = order.quantity;
            }
        }

        Self {
            quote_asset,
            base_asset,
            bids,
            asks,
            last_trade_id,
            current_price,
            depth: DepthMap::new(),
        }
    }
}
