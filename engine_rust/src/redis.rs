use std::error::Error;
use redis::{ AsyncCommands, RedisError, aio::ConnectionManager };
use crate::types::{
    db::DbRequest,
    market::{ Candle, PublishBookWithQuantity, PublishTicker, Ticker },
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
        market: String,
        payload: PublishTicker
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

    pub async fn add_to_rist_router_stream(&mut self, market: String, payload: TradeData)->Result<(),Box<dyn Error>> {
        let stream_key = format!("trade:{}", market);
        let serialized = serde_json::to_string(&payload)?;

        let _: () = self.client.xadd(stream_key, "*", &[("payload", serialized)]).await?;
        Ok(())
    }
}
