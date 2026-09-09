use std::{ cmp::Reverse, collections::BTreeMap };

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct DepthMap {
    pub asks: BTreeMap<u64, u64>,
    pub bids: BTreeMap<Reverse<u64>, u64>,
}

impl DepthMap {
    pub fn init(&self) -> Self {
        Self { asks: BTreeMap::new(), bids: BTreeMap::new() }
    }

    pub fn add(&mut self, side: &str, price: u64, quantity: u64) {
        if quantity == 0 {
            return;
        }

        match side {
            "ask" => {
                *self.asks.entry(price).or_insert(0) += quantity;
            }
            "bid" => {
                *self.bids.entry(Reverse(price)).or_insert(0) += quantity;
            }
            _ => eprintln!("Warning: unrecognized order side '{side}'"),
        }
    }
}
