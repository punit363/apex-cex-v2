use std::{ cmp::Reverse, collections::{ BTreeMap, btree_map::Entry } };

use crate::types::order::OrderSide;
#[derive(Debug, PartialEq, Eq)]
pub struct DepthMap {
    pub asks: BTreeMap<u64, u64>,
    pub bids: BTreeMap<Reverse<u64>, u64>,
}

impl DepthMap {
    pub fn new() -> Self {
        Self { asks: BTreeMap::new(), bids: BTreeMap::new() }
    }

    pub fn add(&mut self, side: &OrderSide, price: u64, quantity: u64) {
        if quantity == 0 {
            return;
        }

        match side {
            OrderSide::Sell => {
                *self.asks.entry(price).or_insert(0) += quantity;
            }
            OrderSide::Buy => {
                *self.bids.entry(Reverse(price)).or_insert(0) += quantity;
            }
        }
    }

    pub fn remove(&mut self, side: &OrderSide, price: u64, quantity: u64) {
        if quantity == 0 {
            return;
        }
        match side {
            OrderSide::Sell =>
                match self.asks.entry(price) {
                    Entry::Occupied(mut entry) => {
                        let current_quantity = *entry.get();
                        if current_quantity > quantity {
                            *entry.get_mut() -= quantity;
                        } else if current_quantity < quantity {
                            self.asks.remove(&price);
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

            OrderSide::Buy =>
                match self.bids.entry(Reverse(price)) {
                    Entry::Occupied(mut entry) => {
                        let current_quantity = *entry.get();
                        if current_quantity > quantity {
                            *entry.get_mut() -= quantity;
                        } else if current_quantity < quantity {
                            self.asks.remove(&price);
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
        }
    }

    pub fn get_asks(&self) -> &BTreeMap<u64, u64> {
        &self.asks
    }

    pub fn get_bids(&self) -> &BTreeMap<Reverse<u64>, u64> {
        &self.bids
    }

    pub fn to_snapshot(&self) {}
}
