use std::error::Error;

use redis::{ AsyncCommands, RedisError, aio::ConnectionManager };

use crate::types::db::DbRequest;

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
}
