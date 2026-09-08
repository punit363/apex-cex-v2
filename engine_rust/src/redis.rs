use std::{ error::Error, time::{ SystemTime, UNIX_EPOCH } };
use redis::{ AsyncCommands, RedisError, aio::ConnectionManager };
use tokio::stream;
use crate::types::{
    db::DbRequest,
    market::{
        Candle,
        PublishBookWithQuantity,
        PublishTicker,
        PublishTickerData,
        SaveTicker,
        Ticker,
    },
    order::PublishOrder,
    trade::{ PublishTrade, TradeData },
};

struct RedisHandler {
    client: ConnectionManager,
    publisher: ConnectionManager,
}

impl RedisHandler {
    pub async fn init(url: &str) -> Result<Self, Box<dyn Error>> {
        let client = redis::Client::open(url)?.get_connection_manager().await?;
        let publisher = redis::Client::open(url)?.get_connection_manager().await?;

        Ok(Self { client, publisher })
    }

    pub async fn get_message(&mut self) -> Result<String, RedisError> {
        let (_key, message): (String, String) = self.client.brpop("MESSAGE", 0.0).await?;
        println!("Received message from {}: {}", _key, message);
        Ok(message)
    }

    pub async fn sent_to_db(&mut self, payload: DbRequest) -> Result<(), Box<dyn Error>> {
        let serialized = serde_json::to_string(&payload)?;
        let _: () = self.client.lpush("DB_UPDATE", serialized).await?;
        Ok(())
    }

    pub async fn publish_order(
        &mut self,
        market: String,
        payload: PublishOrder
    ) -> Result<(), Box<dyn Error>> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("ORDER:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_trade(
        &mut self,
        market: String,
        payload: PublishTrade
    ) -> Result<(), Box<dyn Error>> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("TRADE:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_ticker(
        &mut self,
        market: &str,
        payload: &PublishTicker
    ) -> Result<(), Box<dyn Error>> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("TICKER:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn publish_book_with_quantity(
        &mut self,
        market: String,
        payload: PublishBookWithQuantity
    ) -> Result<(), Box<dyn Error>> {
        let serialized = serde_json::to_string(&payload)?;
        let stream_key = format!("BOOK:{}", market);
        let _: () = self.publisher.publish(stream_key, serialized).await?;

        Ok(())
    }

    pub async fn add_to_rist_router_stream(
        &mut self,
        market: String,
        payload: TradeData
    ) -> Result<(), Box<dyn Error>> {
        let stream_key = format!("trade:{}", market);
        let serialized = serde_json::to_string(&payload)?;

        let _: () = self.client.xadd(stream_key, "*", &[("payload", serialized)]).await?;
        Ok(())
    }

    pub async fn save_ticker_data(
        &mut self,
        market: String,
        payload: SaveTicker
    ) -> Result<(), Box<dyn Error>> {
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

        let open = trade_arr.first().map(|t| t.price).unwrap_or(0);
        let close = trade_arr.last().map(|t| t.price).unwrap_or(0);
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
}
