use std::{ error::Error, time::{ SystemTime, UNIX_EPOCH } };
use redis::{ AsyncCommands, aio::ConnectionManager, streams::StreamReadOptions };
use crate::{
    config::Config,
    types::{
        db::DbRequest,
        market::{ PublishBookWithQuantity, PublishTicker, PublishTickerData, SaveTicker },
        order::{ OrderRequest, PublishOrder },
        trade::{ PublishTrade, TradeData },
    },
};
use redis::streams::{ StreamReadReply };
use std::future::Future;

#[derive(thiserror::Error, Debug)]
pub enum RedisHandlerError {
    #[error("Redis error: {0}")] Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")] Serialization(#[from] serde_json::Error),
    #[error("Invalid UTF-8 in stream payload: {0}")] Utf8(#[from] std::str::Utf8Error),
}

pub struct RedisHandler {
    client: ConnectionManager,
    publisher: ConnectionManager,
    consumer_group: String,
    consumer_name: String,
}

impl RedisHandler {
    pub async fn init(url: &str, config: &Config) -> Result<Self, RedisHandlerError> {
        let client = redis::Client::open(url)?.get_connection_manager().await?;
        let publisher = redis::Client::open(url)?.get_connection_manager().await?;

        let consumer_group = config.consumer_group.clone();
        let consumer_name = config.consumer_name.clone();

        Ok(Self { client, publisher, consumer_group, consumer_name })
    }

    pub async fn sent_to_db(&mut self, payload: DbRequest) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let _: () = self.client.lpush("DB_UPDATE", serialized).await?;
        Ok(())
    }

    pub async fn publish_order(
        &mut self,
        market: String,
        payload: PublishOrder
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("ORDER:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_trade(
        &mut self,
        market: String,
        payload: PublishTrade
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("TRADE:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_ticker(
        &mut self,
        market: &str,
        payload: &PublishTicker
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("TICKER:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_book_with_quantity(
        &mut self,
        market: String,
        payload: PublishBookWithQuantity
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("BOOK:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn set_book_with_quantity(
        &mut self,
        market: &str,
        payload: &PublishBookWithQuantity,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(payload)?;
        let key = format!("DEPTH:{}", market);
        let _: () = self.client.set(key, serialized).await?;
        Ok(())
    }

    pub async fn add_to_risk_router_stream(
        &mut self,
        market: String,
        payload: TradeData
    ) -> Result<(), RedisHandlerError> {
        let stream_key = format!("trade:{}", market);
        let serialized = serde_json::to_string(&payload)?;

        let _: () = self.client.xadd(stream_key, "*", &[("payload", serialized)]).await?;
        Ok(())
    }

    pub async fn save_ticker_data(
        &mut self,
        market: String,
        payload: SaveTicker
    ) -> Result<(), RedisHandlerError> {
        let stream_key = format!("TICKER_TRADES:{}", market);

        let serialized = serde_json::to_string(&payload)?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis() as u64;
        let cutoff = now - 24 * 60 * 60 * 1000;

        let _: () = self.client.zadd(&stream_key, serialized, now).await?;
        let _: () = self.client.zrembyscore(&stream_key, 0, &cutoff).await?;

        let result: Vec<String> = self.client.zrange(&stream_key, 0, -1).await?;
        let trade_arr: Vec<SaveTicker> = result
            .into_iter()
            .filter_map(|item| serde_json::from_str::<SaveTicker>(&item).ok())
            .collect();

        let mut low: u64 = u64::MAX;
        let mut high = 0;
        let mut volume = 0;

        for trade in &trade_arr {
            if trade.price < low {
                low = trade.price;
            }
            if trade.price > high {
                high = trade.price;
            }
            volume += trade.quantity;
        }

        let open = trade_arr
            .first()
            .map(|t| t.price)
            .unwrap_or(0);
        let close = trade_arr
            .last()
            .map(|t| t.price)
            .unwrap_or(0);
        let low = if low == u64::MAX { 0 } else { low };

        let payload = PublishTicker {
            market: &market,
            ticker: PublishTickerData {
                low,
                high,
                volume,
                open,
                close,
                last_price: close,
            },
        };

        let _: () = self.publish_ticker(&market, &payload).await?;
        Ok(())
    }

    pub async fn setup_consumer_group(
        &mut self,
        stream_key: &str,
    ) -> Result<(), RedisHandlerError> {
        let result: Result<(), redis::RedisError> = self.client.xgroup_create_mkstream(
            stream_key,
            &self.consumer_group,
            "$"
        ).await;

        match result {
            Ok(()) => Ok(()),
            Err(err) => {
                // Tolerate BUSYGROUP when the engine restarts
                if err.code() == Some("BUSYGROUP") {
                    Ok(())
                } else {
                    Err(RedisHandlerError::from(err))
                }
            }
        }
    }

    pub async fn consume_order_loop<F, Fut>(
        &mut self,
        stream_key: &str,
        mut on_order: F
    )
        -> Result<(), RedisHandlerError>
        where
            F: FnMut(OrderRequest, String) -> Fut,
            Fut: Future<Output = Result<(), Box<dyn Error>>>
    {
        println!("engine loop started");
        self.setup_consumer_group(stream_key).await?;

        loop {
            let opts = StreamReadOptions::default()
                .group(&self.consumer_group, &self.consumer_name)
                .count(10)
                .block(5000);

            let reply: Option<StreamReadReply> = self.client.xread_options(
                &[&stream_key],
                &[">"],
                &opts
            ).await?;

            let Some(reply) = reply else {
                continue;
            };

            for stream in reply.keys {
                for message in stream.ids {
                    let message_id = message.id;

                    let payload_str = match message.map.get("payload") {
                        Some(redis::Value::BulkString(bytes)) => {
                            match std::str::from_utf8(bytes) {
                                Ok(s) => s,
                                Err(err) => {
                                    eprintln!("Invalid UTF-8 in payload for {message_id}: {err}");
                                    continue;
                                }
                            }
                        }
                        _ => {
                            eprintln!("Missing 'payload' field in message {message_id}");
                            continue;
                        }
                    };

                    // Deserialize the JSON payload
                    let order: OrderRequest = match serde_json::from_str(payload_str) {
                        Ok(order) => order,
                        Err(err) => {
                            eprintln!("Failed parsing order JSON for {message_id}: {err}");
                            continue;
                        }
                    };
                    match on_order(order, message_id.clone()).await {
                        Ok(()) => {
                            let ack_res: Result<(), redis::RedisError> = self.client.xack(
                                stream_key,
                                &self.consumer_group,
                                &[&message_id]
                            ).await;

                            if let Err(ack_err) = ack_res {
                                eprintln!("Failed to XACK message {message_id}: {ack_err}");
                            }
                        }
                        Err(err) => {
                            eprintln!(
                                "Failed processing order {message_id}, will remain pending: {err}"
                            );
                        }
                    }
                }
            }
        }
    }
}
