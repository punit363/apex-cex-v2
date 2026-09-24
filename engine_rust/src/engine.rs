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
\        for key in self.stream_keys.clone() {
            self.redis.setup_consumer_group(&key).await?;
        }

        loop {
            let messages = self.redis
                .read_next_batch(&self.stream_keys.clone())
                .await?;

            for (order, message_id, stream_key) in messages {
                match self.process_order(order).await {
                    Ok(()) => {
\                        if let Err(e) = self.redis.xack(&stream_key, &message_id).await {
                            error!(
                                "Failed to XACK message {} on stream {}: {}",
                                message_id, stream_key, e
                            );
\                        }
                    }
                    Err(e) => {
                        error!(
                            "Failed to process order message {}: {}. Leaving pending for reclaim.",
                            message_id, e
                        );
\                    }
                }
            }
        }
    }

}