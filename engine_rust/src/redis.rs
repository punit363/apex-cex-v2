use std::error::Error;

use redis::aio::ConnectionManager;

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
}
