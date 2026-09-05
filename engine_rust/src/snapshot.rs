use std::{ collections::HashMap, fs::File, io::{ BufReader, BufWriter } };
use serde::{ Deserialize, Serialize };
use crate::types::{ market::Orderbook, order::{ self, Order } };
use thiserror::Error;
use std::time::Duration;
use tokio::time;

#[derive(Error, Debug)]
pub enum SnapshotError {
    // #[from] automatically implements From<std::io::Error> for SnapshotError
    // This allows the `?` operator to cleanly convert file errors.
    #[error("failed to read snapshot file: {0}")] Io(#[from] std::io::Error),

    // #[from] automatically implements From<serde_json::Error> for SnapshotError
    #[error("failed to parse snapshot JSON: {0}")] Json(#[from] serde_json::Error),

    // You can add custom business-logic errors here if you need to later
    #[error("snapshot data was empty or invalid")]
    InvalidData,
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

pub fn read_snapshot(path: String) -> Option<Snapshot> {
    // .ok() converts Result<File, io::Error> into Option<File>
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);

    // .ok() converts Result<Snapshot, serde_json::Error> into Option<Snapshot>
    let snapshot = serde_json::from_reader(reader).ok()?;

    Some(snapshot)
}

pub fn write_snapshot(path: String, snapshot: &Snapshot) -> Result<(), SnapshotError> {
    let file = File::create(path)?;

    // 2. Wrap it in a BufWriter for efficiency
    let writer = BufWriter::new(file);

    // 3. Serialize and write to the file with pretty indentation
    serde_json::to_writer_pretty(writer, &snapshot)?;

    Ok(())
}

pub fn build_snapshot(orderbooks: &HashMap<String, Orderbook>) -> Snapshot {
    let orderbook_snapshots = orderbooks
        .values()
        .map(|ob| OrderbookSnapshot {
            quote_asset: ob.quote_asset.clone(),
            base_asset: ob.base_asset.clone(),
            bids: ob.bids.clone(),
            asks: ob.asks.clone(),
            last_trade_id: ob.last_trade_id.clone(),
            current_price: ob.current_price,
        })
        .collect();

    Snapshot { orderbooks: orderbook_snapshots }
}
