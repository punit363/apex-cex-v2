use std::error::Error;
use tracing::{ error, info };
use tracing_subscriber::{ layer::SubscriberExt, util::SubscriberInitExt, EnvFilter };

mod config;
mod engine;
mod orderbook;
mod redis;
mod snapshot;
mod types;
mod utils;

use config::Config;
use engine::{ build_orderbooks, Engine };
use redis::RedisHandler;
use snapshot::{ load_snapshot, start_snapshot_loop };

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // 1. Load .env file
    dotenvy::dotenv().ok();

    // 2. Initialize tracing with RUST_LOG environment control
    tracing_subscriber
        ::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting High-Performance Crypto Matching Engine...");

    // 3. Load application configuration
    let config = Config::from_env().unwrap_or_else(|err| {
        error!("Fatal: Failed to load configuration: {err}");
        std::process::exit(1);
    });

    info!("Configuration loaded successfully");

    // 4. Load orderbook snapshot from disk if present
    let snapshot = load_snapshot(&config.snapshot_path);
    if snapshot.is_some() {
        info!("Loaded existing orderbook snapshot from {}", config.snapshot_path);
    } else {
        info!("No snapshot found at {}. Starting clean orderbooks.", config.snapshot_path);
    }

    let symbols = config.symbols(); // Derives ["BTC_USDT", ...]

    // 5. Build orderbooks state from snapshot or configured trading pairs
    let orderbooks = build_orderbooks(snapshot, &symbols);
    info!("Initialized {} orderbook(s)", orderbooks.len());

    // 6. Initialize Redis handler and connection pool
    let redis = RedisHandler::init(&config.redis_url, &config).await.unwrap_or_else(|err| {
        error!("Fatal: Failed to connect to Redis at {}: {err}", config.redis_url);
        std::process::exit(1);
    });

    info!("Connected to Redis at {}", config.redis_url);

    // 7. Create watch channel for non-blocking snapshot dispatch
    let (_snapshot_tx, snapshot_rx) = tokio::sync::watch::channel(None);

    // 8. Spawn background snapshot loop worker
    start_snapshot_loop(config.snapshot_path.clone(), snapshot_rx);

    // 9. Build stream keys from symbols (e.g., "symbol" -> "orders:<symbol>")
    let stream_keys: Vec<String> = symbols
    .iter()
    .map(|symbol| format!("orders:{}", symbol))
    .collect();


    info!("Listening on Redis stream keys: {:?}", stream_keys);

    // 10. Construct engine instance
    let mut engine = Engine::new(orderbooks, redis, config.scale(), stream_keys);

    // 11. Prepare graceful shutdown handle
    let shutdown_signal = async {
        match tokio::signal::ctrl_c().await {
            Ok(()) => info!("Shutdown signal received (Ctrl+C). Cleaning up..."),
            Err(err) => error!("Failed to listen for shutdown signal: {err}"),
        }
    };

    // 12. Race engine execution against shutdown signal
    tokio::select! {
        res = engine.run() => {
            if let Err(e) = res {
                error!("Engine execution stopped with error: {e}");
            }
        }
        _ = shutdown_signal => {
            info!("Engine stopped gracefully.");
        }
    }

    Ok(())
}
