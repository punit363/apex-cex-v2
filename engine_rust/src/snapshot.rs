use std::{
    collections::HashMap,
    fs::File,
    io::{BufReader, BufWriter},
    path::Path,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::watch;
use tracing::{error, info};

use crate::{orderbook::Orderbook, types::order::Order};

#[derive(Error, Debug)]
pub enum SnapshotError {
    #[error("failed to read/write snapshot file: {0}")]
    Io(#[from] std::io::Error),

    #[error("failed to parse/serialize snapshot JSON: {0}")]
    Json(#[from] serde_json::Error),

    // #[error("snapshot data was empty or invalid")]
    // InvalidData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderbookSnapshot {
    pub quote_asset: String,
    pub base_asset: String,
    pub bids: Vec<Order>,
    pub asks: Vec<Order>,
    pub last_trade_id: String,
    pub current_price: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Snapshot {
    pub orderbooks: Vec<OrderbookSnapshot>,
}

/// Reads and deserializes a Snapshot from disk.
pub fn load_snapshot<P: AsRef<Path>>(path: P) -> Option<Snapshot> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    serde_json::from_reader(reader).ok()
}

/// Serializes and writes a Snapshot to disk using buffered I/O.
pub fn write_snapshot<P: AsRef<Path>>(path: P, snapshot: &Snapshot) -> Result<(), SnapshotError> {
    let file = File::create(path)?;
    let writer = BufWriter::new(file);
    serde_json::to_writer_pretty(writer, snapshot)?;
    Ok(())
}

/// Converts runtime in-memory Orderbook map into a serializable Snapshot struct.
// pub fn build_snapshot(orderbooks: &HashMap<String, Orderbook>) -> Snapshot {
//     let orderbook_snapshots = orderbooks
//         .values()
//         .map(|ob| OrderbookSnapshot {
//             quote_asset: ob.quote_asset.clone(),
//             base_asset: ob.base_asset.clone(),
//             bids: ob.bids.clone(),
//             asks: ob.asks.clone(),
//             last_trade_id: ob.last_trade_id.clone(),
//             current_price: ob.current_price,
//         })
//         .collect();

//     Snapshot {
//         orderbooks: orderbook_snapshots,
//     }
// }

/// Spawns a background task that listens on the `watch::Receiver` channel
/// and flushes incoming snapshots to disk asynchronously.
pub fn start_snapshot_loop(
    snapshot_path: String,
    mut snapshot_rx: watch::Receiver<Option<Snapshot>>,
) {
    tokio::spawn(async move {
        while snapshot_rx.changed().await.is_ok() {
            let snapshot_opt = snapshot_rx.borrow_and_update().clone();
            if let Some(snapshot) = snapshot_opt {
                let path = snapshot_path.clone();
                // Offload synchronous file I/O to blocking thread pool
                let res = tokio::task::spawn_blocking(move || write_snapshot(&path, &snapshot)).await;

                match res {
                    Ok(Ok(())) => info!("Snapshot written successfully to {}", snapshot_path),
                    Ok(Err(e)) => error!("Failed to write snapshot to disk: {e}"),
                    Err(e) => error!("Snapshot write task panicked: {e}"),
                }
            }
        }
    });
}