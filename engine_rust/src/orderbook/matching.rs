use crate::{
    orderbook::depth::DepthMap,
    types::{
        order::{ IncommingOrder, Order, OrderSide, OrderStatus, OrderType },
        trade::{ Fill, MatchResult },
    },
    utils::{ id::generate_trade_id, time::get_bucket_time },
};

fn order_status(filled: u64, quantity: u64) -> OrderStatus {
    if filled == 0 {
        OrderStatus::Open
    } else if filled >= quantity {
        OrderStatus::Filled
    } else {
        OrderStatus::Partial
    }
}

pub fn execute_sell_order(
    user_id: &str,
    order: &IncommingOrder,
    bids: &mut Vec<Order>,
    asks: &mut Vec<Order>,
    depth: &mut DepthMap
) -> MatchResult {
    let IncommingOrder { order_id, price, quantity, order_type, filled, .. } = order;
    let mut filled = filled.unwrap_or(0);

    let mut fills: Vec<Fill> = Vec::new();
    let mut to_remove: Vec<usize> = Vec::new();
    let bucket_time = get_bucket_time();

    for i in 0..bids.len() {
        let bid = &mut bids[i];

        //why &&?
        if !(order_type == &OrderType::Market || price <= &bid.price) {
            continue;
        }

        let fill_qty = (quantity - filled).min(&bid.quantity - &bid.filled);

        if fill_qty == 0 {
            continue;
        }

        bid.filled += fill_qty;
        bid.status = order_status(bid.filled, bid.quantity);

        depth.remove(&OrderSide::Buy, bid.price, fill_qty);

        let new_fill = Fill {
            price: bid.price,
            quantity: fill_qty,
            trade_id: generate_trade_id(),
            user_id: user_id.to_string(),
            other_user_id: bid.user_id.clone(),
            order_id: order_id.to_string(),
            other_order_id: bid.order_id.clone(),
            other_order_filled: bid.filled,
            other_order_status: bid.status.clone(),
            bucket_time,
        };

        fills.push(new_fill);

        filled += fill_qty;

        if bid.filled >= bid.quantity {
            to_remove.push(i);
        }

        if filled >= *quantity {
            break;
        }
    }

    for &j in to_remove.iter().rev() {
        bids.remove(j);
    }

    let status = order_status(filled, *quantity);

    let unsold_market_order_quantity = if order_type == &OrderType::Market {
        Some(*quantity - filled)
    } else {
        None
    };

    if *order_type == OrderType::Limit && filled < *quantity {
        let resting_order = Order {
            price: *price,
            quantity: *quantity,
            filled,
            status,
            order_id: order_id.to_string(),
            side: OrderSide::Sell,
            user_id: user_id.to_string(),
        };

        let insert_at = asks
            .iter()
            .position(|a| a.price > *price)
            .unwrap_or(asks.len());

        if insert_at == asks.len() {
            asks.push(resting_order);
        } else {
            asks.insert(insert_at, resting_order);
        }
        depth.add(&OrderSide::Sell, *price, quantity - filled);
    }

    MatchResult {
        order_id: order_id.clone(),
        fills,
        status,
        filled,
        unsold_market_order_quantity,
        unused_market_order_amount: None,
    }
}
