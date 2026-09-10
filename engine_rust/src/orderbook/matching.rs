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

        depth.remove(OrderSide::Buy, bid.price, fill_qty);

        let new_fill = Fill {
            price: bid.price,
            quantity: fill_qty,
            trade_id: generate_trade_id(),
            user_id: user_id.to_string(),
            other_user_id: bid.user_id.clone(),
            order_id: order_id.to_string(),
            other_order_id: bid.order_id.clone(),
            other_order_filled: bid.filled,
            other_order_status: bid.status,
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

pub fn execute_buy_order(
    user_id: &str,
    order: &IncommingOrder,
    asks: &mut Vec<Order>,
    bids: &mut Vec<Order>,
    depth: &mut DepthMap,
    scale: &u64
) -> MatchResult {
    let IncommingOrder { order_id, order_type, price, quantity, .. } = order;
    let mut price = *price;
    let mut filled = order.filled.unwrap_or(0);
    let mut fills: Vec<Fill> = Vec::new();
    let mut to_remove: Vec<usize> = Vec::new();
    let bucket_time = get_bucket_time();

    for i in 0..asks.len() {
        let ask = &mut asks[i]; //why does this only work with &mut asks[i]? although we too require a mutable refernece here but still.

        if *order_type == OrderType::Limit {
            if price < ask.price {
                break;
            }

            let fill_qty = (quantity - filled).min(ask.quantity - ask.filled);
            if fill_qty == 0 {
                continue;
            }

            ask.status = order_status(ask.filled, ask.quantity);
            depth.remove(OrderSide::Sell, ask.price, fill_qty);

            let new_fill = Fill {
                price: ask.price,
                quantity: fill_qty,
                trade_id: generate_trade_id(),
                user_id: user_id.to_string(),
                other_user_id: ask.user_id.clone(),
                order_id: order_id.to_string(),
                other_order_id: ask.order_id.clone(),
                other_order_filled: ask.filled,
                other_order_status: ask.status,
                bucket_time,
            };

            fills.push(new_fill);

            filled += fill_qty;
            if ask.filled >= ask.quantity {
                to_remove.push(i);
            }
            if filled >= *quantity {
                break;
            }
        } else {
            /*TODO:  what happens in this case 
            (price * SCALE) / ask.price
            10/3? is satoshi scale usefull? where does .6666666 stop? */
            let affordable_base = (price * scale) / ask.price;
            let available_base = ask.quantity - ask.filled;

            let fill_qty = affordable_base.min(available_base);
            if fill_qty == 0 {
                break;
            }

            ask.filled += fill_qty;
            ask.status = order_status(ask.filled, ask.quantity);
            depth.remove(OrderSide::Sell, ask.price, fill_qty);

            let new_fill = Fill {
                price: ask.price,
                quantity: fill_qty,
                trade_id: generate_trade_id(),
                user_id: user_id.to_string(),
                other_user_id: ask.user_id.clone(),
                order_id: order_id.to_string(),
                other_order_id: ask.order_id.clone(),
                other_order_filled: ask.filled,
                other_order_status: ask.status,
                bucket_time,
            };

            fills.push(new_fill);
            price -= (fill_qty * ask.price) / scale;
            if ask.filled >= ask.quantity {
                to_remove.push(i);
            }
            if price == 0 {
                break;
            }
        }
    }

    for i in 0..to_remove.len() {
        asks.remove(i);
    }

    if *order_type == OrderType::Limit && filled < *quantity {
        let resting_order = Order {
            price: order.price,
            quantity: *quantity,
            filled,
            status: order_status(filled, *quantity),
            order_id: order_id.to_string(),
            side: OrderSide::Buy,
            user_id: user_id.to_string(),
        };
        let insert_at = bids
            .iter()
            .position(|b| b.price < order.price)
            .unwrap_or(bids.len());
        if insert_at == bids.len() {
            bids.push(resting_order);
        } else {
            bids.insert(insert_at, resting_order);
        }
        depth.remove(OrderSide::Buy, order.price, quantity - filled);
    }

    let unused_market_order_amount = if *order_type == OrderType::Market {
        Some(price)
    } else {
        None
    };

    let status = if *order_type == OrderType::Limit {
        order_status(filled, *quantity)
    } else if price > 0 {
        OrderStatus::Partial
    } else {
        OrderStatus::Filled
    };

    MatchResult {
        order_id: order_id.to_string(),
        fills,
        status,
        filled,
        unused_market_order_amount,
        unsold_market_order_quantity: None,
    }
}
