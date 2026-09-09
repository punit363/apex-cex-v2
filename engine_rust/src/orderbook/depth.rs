use std::{ cmp::Reverse, collections::{ BTreeMap, btree_map::Entry } };

use serde_json::map::Entry;

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

    pub fn remove(&mut self, side: &str, price: u64, quantity: u64) {
        if quantity == 0 {
            return;
        }
        match side {
            "ask" =>
                match self.asks.entry(price) {
                    Entry::Occupied(mut entry) => {
                        let current_quantity = *entry.get();
                        if current_quantity > quantity {
                            *entry.get_mut() -= quantity;
                        } else if current_quantity < quantity {
                            eprintln!(
                                "Not enough depth. This removal creates negative depth in ask."
                            )
                        } else {
                            self.asks.remove(&price);
                        }
                    }
                    Entry::Vacant(_) => {
                        eprintln!(
                            "[WARN] Attempted to remove from non-existent ask price level: {price}"
                        );
                    }
                }

            "bid" =>
                match self.bids.entry(Reverse(price)) {
                    Entry::Occupied(mut entry) => {
                        let current_quantity = *entry.get();
                        if current_quantity > quantity {
                            *entry.get_mut() -= quantity;
                        } else if current_quantity < quantity {
                            eprintln!(
                                "Not enough depth. This removal creates negative depth in bid."
                            )
                        } else {
                            self.bids.remove(&Reverse(price));
                        }
                    }
                    Entry::Vacant(_) => {
                        eprintln!(
                            "[WARN] Attempted to remove from non-existent ask price level: {price}"
                        );
                    }
                }
            _ => eprintln!("Warning: unrecognized order side '{side}'"),
        }
    }
}
