use std::time::{SystemTime, UNIX_EPOCH};
use redis::{
    aio::ConnectionManager,
    streams::{StreamReadOptions, StreamReadReply},
    AsyncCommands,
};
use serde::Serialize;

use crate::{
    config::Config,
    types::{
        db::DbRequest,
        market::{PublishBookWithQuantity, PublishTicker, PublishTickerData, SaveTicker},
        order::{OrderRequest, PublishOrder},
        trade::{PublishTrade, UserEvent},
    },
};

#[derive(thiserror::Error, Debug)]
pub enum RedisHandlerError {
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Invalid UTF-8 in stream payload: {0}")]
    Utf8(#[from] std::str::Utf8Error),
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

        Ok(Self {
            client,
            publisher,
            consumer_group: config.consumer_group.clone(),
            consumer_name: config.consumer_name.clone(),
        })
    }

    pub async fn send_to_db(&mut self, payload: DbRequest) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let _: () = self.client.lpush("DB_UPDATE", serialized).await?;
        Ok(())
    }

    pub async fn publish_order(
        &mut self,
        market: &str,
        payload: PublishOrder,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let channel = format!("ORDER:{}", market);
        let _: () = self.publisher.publish(channel, serialized).await?;
        Ok(())
    }

    pub async fn publish_trade(
        &mut self,
        market: &str,
        payload: PublishTrade,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let channel = format!("TRADE:{}", market);
        let _: () = self.publisher.publish(channel, serialized).await?;
        Ok(())
    }

    pub async fn publish_ticker(
        &mut self,
        market: &str,
        payload: &PublishTicker,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(payload)?;
        let channel = format!("TICKER:{}", market);
        let _: () = self.publisher.publish(channel, serialized).await?;
        Ok(())
    }

    pub async fn publish_book_with_quantity(
        &mut self,
        market: &str,
        payload: PublishBookWithQuantity,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(&payload)?;
        let channel = format!("BOOK:{}", market);
        let _: () = self.publisher.publish(channel, serialized).await?;
        Ok(())
    }

    pub async fn publish_user_event(
        &mut self,
        user_id: &str,
        payload: &UserEvent,
    ) -> Result<(), RedisHandlerError> {
        let serialized = serde_json::to_string(payload)?;
        let channel = format!("user:{}", user_id);
        let _: () = self.publisher.publish(channel, serialized).await?;
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

    /// Generic router event publisher to allow TradeData, CancellationEvent, etc.
    pub async fn add_to_risk_router_stream<T: Serialize>(
        &mut self,
        market: &str,
        payload: T,
    ) -> Result<(), RedisHandlerError> {
        let stream_key = format!("trade:{}", market);
        let serialized = serde_json::to_string(&payload)?;

        let _: () = self
            .client
            .xadd(stream_key, "*", &[("payload", serialized)])
            .await?;
        Ok(())
    }

    pub async fn xack(
        &mut self,
        stream_key: &str,
        message_id: &str,
    ) -> Result<(), RedisHandlerError> {
        let _: () = self
            .client
            .xack(stream_key, &self.consumer_group, &[message_id])
            .await?;
        Ok(())
    }

    pub async fn save_ticker_data(
        &mut self,
        market: &str,
        payload: SaveTicker,
    ) -> Result<(), RedisHandlerError> {
        let stream_key = format!("TICKER_TRADES:{}", market);

        let serialized = serde_json::to_string(&payload)?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
            .as_millis() as u64;
        let cutoff = now.saturating_sub(24 * 60 * 60 * 1000);

        let _: () = self.client.zadd(&stream_key, serialized, now).await?;
        let _: () = self.client.zrembyscore(&stream_key, 0, cutoff).await?;

        let result: Vec<String> = self.client.zrange(&stream_key, 0, -1).await?;
        let trade_arr: Vec<SaveTicker> = result
            .into_iter()
            .filter_map(|item| serde_json::from_str::<SaveTicker>(&item).ok())
            .collect();

        let mut low: u64 = u64::MAX;
        let mut high: u64 = 0;
        let mut volume: u64 = 0;

        for trade in &trade_arr {
            if trade.price < low {
                low = trade.price;
            }
            if trade.price > high {
                high = trade.price;
            }
            volume += trade.quantity;
        }

        let open = trade_arr.first().map(|t| t.price).unwrap_or(0);
        let close = trade_arr.last().map(|t| t.price).unwrap_or(0);
        let low = if low == u64::MAX { 0 } else { low };

        let ticker_payload = PublishTicker {
            market:market.to_string(),
            ticker: PublishTickerData {
                low,
                high,
                volume,
                open,
                close,
                last_price: close,
            },
        };

        self.publish_ticker(market, &ticker_payload).await?;
        Ok(())
    }

    pub async fn setup_consumer_group(
        &mut self,
        stream_key: &str,
    ) -> Result<(), RedisHandlerError> {
        let result: Result<(), redis::RedisError> = self
            .client
            .xgroup_create_mkstream(stream_key, &self.consumer_group, "$")
            .await;

        match result {
            Ok(()) => Ok(()),
            Err(err) if err.code() == Some("BUSYGROUP") || err.to_string().contains("BUSYGROUP") => {
                Ok(())
            }
            Err(err) => Err(RedisHandlerError::from(err)),
        }
    }

    /// Reads batch of messages across all configured stream keys
    pub async fn read_next_batch(
        &mut self,
        stream_keys: &[String],
    ) -> Result<Vec<(OrderRequest, String, String)>, RedisHandlerError> {
        let opts = StreamReadOptions::default()
            .group(&self.consumer_group, &self.consumer_name)
            .count(10)
            .block(5000);

        let ids: Vec<&str> = vec![">"; stream_keys.len()];
        let keys_str: Vec<&str> = stream_keys.iter().map(|s| s.as_str()).collect();

        let reply: Option<StreamReadReply> = self
            .client
            .xread_options(&keys_str, &ids, &opts)
            .await?;

        let mut parsed_messages = Vec::new();

        if let Some(reply) = reply {
            for stream_entry in reply.keys {
                let stream_key = stream_entry.key;
                for message in stream_entry.ids {
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

                    match serde_json::from_str::<OrderRequest>(payload_str) {
                        Ok(order) => {
                            parsed_messages.push((order, message_id, stream_key.clone()));
                        }
                        Err(err) => {
                            eprintln!("Failed parsing order JSON for {message_id}: {err}");
                        }
                    }
                }
            }
        }

        Ok(parsed_messages)
    }
}