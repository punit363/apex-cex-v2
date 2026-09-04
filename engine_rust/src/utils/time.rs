use std::time::{SystemTime, UNIX_EPOCH};

pub fn getBucketTime()->u64{
    let now = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .expect("Time went backwards")
    .as_millis() as u64;

now - (now % 60_000)
}