use crate::{
    orderbook::{ depth::DepthMap, matching::{ execute_buy_order, execute_sell_order } },
    types::{
        market::{ EngineResponse, EngineResponseStatus },
        order::{ IncommingOrder, Order, OrderSide, OrderType },
    },
};

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

    fn rebuild_depth_cache(&mut self) {
        for bid in &self.bids {
            let remaining_qty = bid.quantity - bid.filled;
            self.depth.add(crate::types::order::OrderSide::Buy, bid.price, remaining_qty);
        }

        for ask in &self.asks {
            let remaining_qty = ask.quantity - ask.filled;
            self.depth.add(crate::types::order::OrderSide::Buy, ask.price, remaining_qty);
        }
    }

    fn market_key(&self) -> String {
        format!("{}_{}", self.base_asset, self.quote_asset)
    }

    pub fn place_order(
        &mut self,
        user_id: &str,
        order: IncommingOrder,
        scale: u64
    ) -> EngineResponseStatus {
        if order.order_type == OrderType::Limit && order.price == 0 {
            EngineResponseStatus::Failed;
        }

        let result = match order.side {
            OrderSide::Buy =>
                execute_buy_order(
                    user_id,
                    &order,
                    &mut self.asks,
                    &mut self.bids,
                    &mut self.depth,
                    &scale
                ),
            OrderSide::Sell =>
                execute_sell_order(
                    user_id,
                    &order,
                    &mut self.asks,
                    &mut self.bids,
                    &mut self.depth
                ),
        };

        if result.fills.len() > 0 {
            self.current_price = result.fills.last().unwrap().price;
            self.last_trade_id = result.fills.last().unwrap().trade_id.clone();
        }

        EngineResponseStatus::Success
    }

    pub fn cancel_order(
        &mut self,
        user_id: &str,
        order_id: &str,
        side: OrderSide
    ) -> EngineResponse<Order> {
        let order = match side {
            OrderSide::Buy =>
                self.bids.iter().find(|bid| bid.order_id == order_id && bid.user_id == user_id),
            OrderSide::Sell =>
                self.asks.iter().find(|ask| ask.order_id == order_id && ask.user_id == user_id),
        };

        let idx = match side {
            OrderSide::Buy =>
            self.bids.iter().position(|b| b.order_id == order_id && b.user_id == user_id),
            OrderSide::Sell =>
            self.asks.iter().position(|b| b.order_id == order_id && b.user_id == user_id),
        };

        if order.is_none() {
            return EngineResponse {
                status: EngineResponseStatus::Failed,
                odb_status_code: 0,
                message: format!("Failed to find order"),
                data: None,
            };
        } else {
            if order.unwrap().filled >= order.unwrap().quantity {
                return EngineResponse {
                    status: EngineResponseStatus::Failed,
                    odb_status_code: 0,
                    message: format!("Failed the order is already filled"),
                    data: None,
                };
            } else {
                let remaining = order.unwrap().quantity - order.unwrap().filled;
                match side {
                    OrderSide::Buy => self.depth.remove(OrderSide::Buy, order.unwrap().price, remaining),
                    OrderSide::Sell => self.depth.remove(OrderSide::Sell, order.unwrap().price, remaining),
                };

                match side {
                    OrderSide::Buy =>
                        self.bids.remove(idx.unwrap()),
                    OrderSide::Sell =>
                        self.asks.remove(idx.unwrap()),
                };
            };
        }
        EngineResponse { status:EngineResponseStatus::Success, odb_status_code: 1, message: format!("Order Successfully cancelled"), data: order.cloned() }
    }

    pub fn get_book_with_quantities(&self) -> DepthMap {
        self.depth.clone()
    }

    pub fn fetch_open_orders(&self) -> (Vec<Order>, Vec<Order>) {
        (self.bids.clone(), self.asks.clone())
    }
}
