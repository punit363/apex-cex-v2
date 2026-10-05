use serde::Deserialize;
use std::env::{ self, VarError };
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Environment variable '{key}' is missing or invalid: {source}")] MissingOrInvalidVar {
        key: &'static str,
        #[source]
        source: VarError,
    },

    #[error(
        "Failed to parse environment variable '{key}' (value: '{value}'): {message}"
    )] ParseError {
        key: &'static str,
        value: String,
        message: String,
    },

    #[error("Failed to parse JSON for environment variable '{key}': {source}")] JsonParseError {
        key: &'static str,
        #[source]
        source: serde_json::Error,
    },
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct SupportedMarket {
    pub base: String,
    pub quote: String,
}

#[derive(Debug, Clone)]
pub struct Config {
    // General & Engine Core
    pub satoshi_scale: u64,
    pub redis_url: String,
    pub snapshot_path: String,

    // Engine
    pub consumer_group: String,
    pub consumer_name: String,

    // Market Maker
    pub supported_markets: Vec<SupportedMarket>,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        // Attempt to load .env; ignore error if file is missing (e.g. in containerized setups)
        let _ = dotenvy::dotenv();

        Ok(Self {
            // General & Engine Core
            satoshi_scale: parse_env("SATOSHI_SCALE")?,
            redis_url: read_env("REDIS_URL")?,
            snapshot_path: read_env("SNAPSHOT_PATH").unwrap_or_else(|_|
                "snapshot.json".to_string()
            ),

            // Engine
            consumer_group: read_env("ENG_CONSUMER_GROUP")?,
            consumer_name: read_env("ENG_CONSUMER_NAME")?,

            // Market Maker
            supported_markets: parse_json_env("SUPPORTED_MARKETS")?,
        })
    }

    /// Convenience getter for `satoshi_scale` matching `config.scale` usages in `main.rs` & `Engine`.
    pub fn scale(&self) -> u64 {
        self.satoshi_scale
    }

    /// Derives market symbol pairs (e.g. `["BTC_USDT", "ETH_USDT"]`) from `supported_markets`.
    pub fn symbols(&self) -> Vec<String> {
        self.supported_markets
            .iter()
            .map(|m| format!("{}_{}", m.base, m.quote))
            .collect()
    }
}

// Helpers for reading and type conversion

fn read_env(key: &'static str) -> Result<String, ConfigError> {
    env::var(key)
        .map(|v| v.trim().trim_matches('"').trim_matches('\'').to_string())
        .map_err(|source| ConfigError::MissingOrInvalidVar { key, source })
}

fn parse_env<T>(key: &'static str) -> Result<T, ConfigError>
    where T: std::str::FromStr, T::Err: std::fmt::Display
{
    let raw = read_env(key)?;
    // Strip trailing inline comments if present in raw .env entries (e.g., "900000 # 15 * 60 * 1000")
    let cleaned = raw.split('#').next().unwrap_or("").trim();

    cleaned.parse::<T>().map_err(|err| ConfigError::ParseError {
        key,
        value: raw,
        message: err.to_string(),
    })
}

fn parse_json_env<T>(key: &'static str) -> Result<T, ConfigError> where T: for<'de> Deserialize<'de> {
    let raw = read_env(key)?;
    serde_json::from_str::<T>(&raw).map_err(|source| ConfigError::JsonParseError { key, source })
}
