use std::collections::HashMap;
use tracing::{error, warn};
use crate::{
    config::Config,
    orderbook::Orderbook,
    redis::{ RedisHandler, RedisHandlerError },
    snapshot::{ build_orderbooks, Snapshot },
    types::{
        order::{ OrderRequest, OrderSide, IncommingOrder, OrderType },
        trade::{ TradeData, CancellationEvent },
        db::DbRequest,
        market::{ EngineResponseStatus, PublishBookWithQuantity, PublishOrder, PublishTrade },
    },
};

pub struct Engine {
    orderbooks: HashMap<String, Orderbook>,
    redis: RedisHandler,
    scale: u64,
    stream_keys: Vec<String>,
}

impl Engine {
    pub fn new(
        orderbooks: HashMap<String, Orderbook>,
        redis: RedisHandler,
        scale: u64,
        stream_keys: Vec<String>,
    ) -> Self {
        Self { orderbooks, redis, scale, stream_keys }
    }

    pub async fn run(&mut self) -> Result<(), RedisHandlerError> {
        for key in self.stream_keys.clone() {
            self.redis.setup_consumer_group(&key).await?;
        }

        loop {
            let messages = self.redis
                .read_next_batch(&self.stream_keys.clone())
                .await?;

            for (order, message_id, stream_key) in messages {
                match self.process_order(order).await {
                    Ok(()) => {
                        if let Err(e) = self.redis.xack(&stream_key, &message_id).await {
                            error!(
                                "Failed to XACK message {} on stream {}: {}",
                                message_id, stream_key, e
                            );
                        }
                    }
                    Err(e) => {
                        error!(
                            "Failed to process order message {}: {}. Leaving pending for reclaim.",
                            message_id, e
                        );
                    }
                }
            }
        }
    }


    async fn process_order(&mut self, order: OrderRequest) -> Result<(), RedisHandlerError> {
        match order.action.as_str() {
            "PLACE_ORDER" => self.handle_place_order(order).await,
            "CANCEL_ORDER" => self.handle_cancel_order(order).await,
            other => {
                warn!("Unknown order action received: {}", other);
                Ok(())
            }
        }
    }

    async fn handle_place_order(&mut self, order: OrderRequest) -> Result<(), RedisHandlerError> {
        let user_id = order.user_id.clone();
        let base_asset = order.order_data.base_asset.clone();
        let quote_asset = order.order_data.quote_asset.clone();
        let market = format!("{}_{}", base_asset, quote_asset);

        let orderbook = match self.orderbooks.get_mut(&market) {
            Some(ob) => ob,
            None => {
                error!("No orderbook found for market {}", market);
                let _ = self.redis.publish_user_event(
                    &user_id,
                    &crate::types::trade::UserEvent::OrderRejected {
                        order_id: order.order_data.order_id.clone(),
                        reason: format!("Market {} is not supported", market),
                    }
                ).await;
                return Ok(());
            }
        };

        let incoming = IncommingOrder {
            order_id: order.order_data.order_id.clone(),
            price: order.order_data.price,
            quantity: order.order_data.quantity,
            side: order.order_data.side.clone(),
            order_type: order.order_data.order_type.clone(),
            filled: None,
            status: None,
        };

        let response = orderbook.place_order(&user_id, incoming, self.scale);

        match response.status {
            EngineResponseStatus::Failed => {
                let _ = self.redis.publish_user_event(
                    &user_id,
                    &crate::types::trade::UserEvent::OrderRejected {
                        order_id: order.order_data.order_id.clone(),
                        reason: response.message.clone(),
                    }
                ).await;
                return Ok(());
            }
            EngineResponseStatus::Success => {
                let result = response.data.unwrap();
                let side = order.order_data.side.clone();
                let price = order.order_data.price;
                let quantity = order.order_data.quantity;
                let order_id = order.order_data.order_id.clone();
                let order_type = order.order_data.order_type.clone();

                let (bids_snapshot, asks_snapshot) = self.orderbooks
                    .get(&market)
                    .map(|ob| ob.get_book_with_quantities())
                    .unwrap_or_default();

                let book_payload = PublishBookWithQuantity {
                    market: market.clone(),
                    bids: bids_snapshot.clone(),
                    asks: asks_snapshot.clone(),
                };

                let _ = self.redis.publish_book_with_quantity(
                    market.clone(),
                    book_payload.clone()
                ).await;

                let _ = self.redis.set_book_with_quantity(&market, &book_payload).await;

                let order_payload = PublishOrder {
                    market: market.clone(),
                    order_id: order_id.clone(),
                    user_id: user_id.clone(),
                    side: side.clone(),
                    order_type: order_type.clone(),
                    price,
                    quantity,
                    filled_quantity: result.filled,
                    status: result.status.clone(),
                    base_asset: base_asset.clone(),
                    quote_asset: quote_asset.clone(),
                };

                let _ = self.redis.publish_order(market.clone(), order_payload).await;
\
                if let Err(e) = self.redis.send_to_db(DbRequest::AddOrder {
                    order_id: order_id.clone(),
                    user_id: user_id.clone(),
                    side: side.clone(),
                    order_type: order_type.clone(),
                    price,
                    quantity,
                    filled_quantity: result.filled,
                    status: result.status.clone(),
                    base_asset: base_asset.clone(),
                    quote_asset: quote_asset.clone(),
                }).await {
                    error!("[CRITICAL] ADD_ORDER DB sync failed for order {}: {}", order_id, e);
                }

\                if !result.fills.is_empty() {

\                    let trade_data = TradeData {
                        action: "TRADE_EXECUTED".to_string(),
                        market: market.clone(),
                        placed_order: crate::types::trade::PlacedOrderData {
                            user_id: user_id.clone(),
                            order_id: order_id.clone(),
                            price,
                            quantity,
                            side: side.clone(),
                            order_type: order_type.clone(),
                            base_asset: base_asset.clone(),
                            quote_asset: quote_asset.clone(),
                            status: result.status.clone(),
                            filled: result.filled,
                            unsold_market_order_quantity: result.unsold_market_order_quantity,
                            unused_market_order_amount: result.unused_market_order_amount,
                        },
                        trades: result.fills.clone(),
                    };

                    if let Err(e) = self.redis
                        .add_to_risk_router_stream(market.clone(), trade_data)
                        .await
                    {
                        error!(
                            "[CRITICAL] add_to_risk_router_stream failed for order {}: {}",
                            order_id, e
                        );
                    }

              let _ = self.redis.publish_trade(
                        market.clone(),
                        PublishTrade {
                            market: market.clone(),
                            trade: result.fills.clone(),
                        }
                    ).await;

                    for fill in &result.fills {
                        let _ = self.redis.save_ticker_data(
                            market.clone(),
                            crate::types::market::SaveTicker {
                                market: market.clone(),
                                price: fill.price,
                                quantity: fill.quantity,
                                trade_id: fill.trade_id.clone(),
                            }
                        ).await;
                    }

                    let trades: Vec<_> = result.fills.iter().map(|fill| {
                        crate::types::db::TradeRecord {
                            trade_id: fill.trade_id.clone(),
                            user_id: user_id.clone(),
                            other_user_id: fill.other_user_id.clone(),
                            order_id: order_id.clone(),
                            other_order_id: fill.other_order_id.clone(),
                            price: fill.price,
                            quantity: fill.quantity,
                            base_asset: base_asset.clone(),
                            quote_asset: quote_asset.clone(),
                            side: side.clone(),
                        }
                    }).collect();

                    if let Err(e) = self.redis.send_to_db(DbRequest::AddTrades {
                        trades,
                    }).await {
                        error!("[CRITICAL] ADD_TRADES DB sync failed for order {}: {}", order_id, e);
                    }

                    let update_orders: Vec<_> = result.fills.iter().map(|fill| {
                        crate::types::db::UpdateOrder {
                            order_id: fill.other_order_id.clone(),
                            filled: fill.other_order_filled,
                            status: fill.other_order_status.clone(),
                        }
                    }).collect();

                    if let Err(e) = self.redis.send_to_db(DbRequest::UpdateOrders {
                        update_orders,
                    }).await {
                        error!(
                            "[CRITICAL] UPDATE_ORDERS DB sync failed for order {}: {}",
                            order_id, e
                        );
                    }
                }
            }
        }

        Ok(())
    }


    async fn handle_cancel_order(&mut self, order: OrderRequest) -> Result<(), RedisHandlerError> {
        let user_id = order.user_id.clone();
        let base_asset = order.order_data.base_asset.clone();
        let quote_asset = order.order_data.quote_asset.clone();
        let market = format!("{}_{}", base_asset, quote_asset);
        let order_id = order.order_data.order_id.clone();
        let side = order.order_data.side.clone();

        let orderbook = match self.orderbooks.get_mut(&market) {
            Some(ob) => ob,
            None => {
                error!("No orderbook found for market {} during cancel", market);
                let _ = self.redis.publish_user_event(
                    &user_id,
                    &crate::types::trade::UserEvent::CancelRejected {
                        order_id: order_id.clone(),
                        reason: format!("Market {} is not supported", market),
                    }
                ).await;
                return Ok(());
            }
        };

        let response = orderbook.cancel_order(&user_id, &order_id, side.clone());

        match response.status {
            EngineResponseStatus::Failed => {
                let _ = self.redis.publish_user_event(
                    &user_id,
                    &crate::types::trade::UserEvent::CancelRejected {
                        order_id: order_id.clone(),
                        reason: response.message.clone(),
                    }
                ).await;
            }
            EngineResponseStatus::Success => {
                let cancelled = response.data.unwrap();

                if let Err(e) = self.redis.send_to_db(DbRequest::CancelOrder {
                    order_id: order_id.clone(),
                    status: "cancelled".to_string(),
                }).await {
                    error!(
                        "[CRITICAL] CANCEL_ORDER DB sync failed for order {}: {}",
                        order_id, e
                    );
                }

                let cancellation = CancellationEvent {
                    action: "ORDER_CANCELLATION".to_string(),
                    market: market.clone(),
                    order_id: order_id.clone(),
                    user_id: user_id.clone(),
                    side: side.clone(),
                    quantity: cancelled.quantity,
                    filled: cancelled.filled,
                    price: cancelled.price,
                    base_asset: base_asset.clone(),
                    quote_asset: quote_asset.clone(),
                };

                if let Err(e) = self.redis
                    .add_to_risk_router_stream(market.clone(), cancellation)
                    .await
                {
                    error!(
                        "[CRITICAL] Risk router stream failed for cancel order {}: {}",
                        order_id, e
                    );
                }

                let (bids_snapshot, asks_snapshot) = self.orderbooks
                    .get(&market)
                    .map(|ob| ob.get_book_with_quantities())
                    .unwrap_or_default();

                let book_payload = PublishBookWithQuantity {
                    market: market.clone(),
                    bids: bids_snapshot,
                    asks: asks_snapshot,
                };

                let _ = self.redis.publish_book_with_quantity(
                    market.clone(),
                    book_payload.clone()
                ).await;

                let _ = self.redis.set_book_with_quantity(&market, &book_payload).await;
            }
        }

        Ok(())
    }
}


pub fn build_orderbooks(
    snapshot: Option<Snapshot>,
    symbols: &[String],
) -> HashMap<String, Orderbook> {
    let mut map = HashMap::new();

    match snapshot {
        Some(snap) => {
            for ob in snap.orderbooks {
                let key = format!("{}_{}", ob.base_asset, ob.quote_asset);
                map.insert(
                    key,
                    Orderbook::new(
                        ob.base_asset,
                        ob.quote_asset,
                        ob.bids,
                        ob.asks,
                        ob.last_trade_id,
                        ob.current_price,
                    ),
                );
            }
        }
        None => {
            for symbol in symbols {
                let parts: Vec<&str> = symbol.splitn(2, '_').collect();
                if parts.len() != 2 {
                    error!("Invalid symbol format in config: {}", symbol);
                    continue;
                }
                map.insert(
                    symbol.clone(),
                    Orderbook::new(
                        parts[0].to_string(),
                        parts[1].to_string(),
                        vec![],
                        vec![],
                        String::new(),
                        0,
                    ),
                );
            }
        }
    }

    map

}