use serde::Deserialize;
use std::env::{self, VarError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Environment variable '{key}' is missing or invalid: {source}")]
    MissingOrInvalidVar {
        key: &'static str,
        #[source]
        source: VarError,
    },

    #[error("Failed to parse environment variable '{key}' (value: '{value}'): {message}")]
    ParseError {
        key: &'static str,
        value: String,
        message: String,
    },

    #[error("Failed to parse JSON for environment variable '{key}': {source}")]
    JsonParseError {
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
    // General
    pub satoshi_scale: u64,

    // Database
    pub db_user: String,
    pub db_password: String,
    pub db_name: String,
    pub database_url: String,

    // API & Auth
    pub access_token_secret: String,
    pub access_token_expires_in: String,
    pub refresh_token_secret: String,
    pub refresh_token_expires_in: String,
    pub access_cookie_age: u64,
    pub refresh_cookie_age: u64,
    pub client_url: String,
    pub cors_accepted_endpoint: String,
    pub api_port: u16,

    // Frontend Public
    pub next_public_api_url: String,
    pub next_public_ws_url: String,
    pub next_public_satoshi_scale: u64,
    pub next_public_access_cookie_age: u64,
    pub next_public_refresh_cookie_age: u64,

    // Sockets
    pub ws_port: u16,

    // Market Maker
    pub mm_quote_asset: String,
    pub mm_base_asset: String,
    pub supported_markets: Vec<SupportedMarket>,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        // Attempt to load .env; ignore error if file is missing (e.g. in containerized setups)
        let _ = dotenvy::dotenv();

        Ok(Self {
            // General
            satoshi_scale: parse_env("SATOSHI_SCALE")?,

            // Database
            db_user: read_env("DB_USER")?,
            db_password: read_env("DB_PASSWORD")?,
            db_name: read_env("DB_NAME")?,
            database_url: read_env("DATABASE_URL")?,

            // API & Auth
            access_token_secret: read_env("ACCESS_TOKEN_SECRET")?,
            access_token_expires_in: read_env("ACCESS_TOKEN_EXPIRES_IN")?,
            refresh_token_secret: read_env("REFRESH_TOKEN_SECRET")?,
            refresh_token_expires_in: read_env("REFRESH_TOKEN_EXPIRES_IN")?,
            access_cookie_age: parse_env("ACCESS_COOKIE_AGE")?,
            refresh_cookie_age: parse_env("REFRESH_COOKIE_AGE")?,
            client_url: read_env("CLIENT_URL")?,
            cors_accepted_endpoint: read_env("CORS_ACCEPTED_ENDPOINT")?,
            api_port: parse_env("API_PORT")?,

            // Frontend Public
            next_public_api_url: read_env("NEXT_PUBLIC_API_URL")?,
            next_public_ws_url: read_env("NEXT_PUBLIC_WS_URL")?,
            next_public_satoshi_scale: parse_env("NEXT_PUBLIC_SATOSHI_SCALE")?,
            next_public_access_cookie_age: parse_env("NEXT_PUBLIC_ACCESS_COOKIE_AGE")?,
            next_public_refresh_cookie_age: parse_env("NEXT_PUBLIC_REFRESH_COOKIE_AGE")?,

            // Sockets
            ws_port: parse_env("WS_PORT")?,

            // Market Maker
            mm_quote_asset: read_env("MM_QUOTE_ASSET")?,
            mm_base_asset: read_env("MM_BASE_ASSET")?,
            supported_markets: parse_json_env("SUPPORTED_MARKETS")?,
        })
    }
}

// Helpers for reading and type conversion

fn read_env(key: &'static str) -> Result<String, ConfigError> {
    env::var(key)
        .map(|v| v.trim().trim_matches('"').trim_matches('\'').to_string())
        .map_err(|source| ConfigError::MissingOrInvalidVar { key, source })
}

fn parse_env<T>(key: &'static str) -> Result<T, ConfigError>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    let raw = read_env(key)?;
    // Strip trailing inline comments if present in raw .env entries (e.g., "900000 # 15 * 60 * 1000")
    let cleaned = raw.split('#').next().unwrap_or("").trim();
    //Splits the string into pieces around the # delimiter
    //Takes the first element produced by the split

    cleaned
        .parse::<T>()
        .map_err(|err| ConfigError::ParseError {
            key,
            value: raw,
            message: err.to_string(),
        })
}

fn parse_json_env<T>(key: &'static str) -> Result<T, ConfigError>
where
    T: for<'de> Deserialize<'de>,
{
    let raw = read_env(key)?;
    serde_json::from_str::<T>(&raw).map_err(|source| ConfigError::JsonParseError {
        key,
        source,
    })
}