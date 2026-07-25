interface User {
  user_id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  age: number;
  refresh_token?: string;
  phone: string;
}

interface Transaction {
  tx_id: string;
  user_id: string;
  type: string;
  asset: string;
  amount: number;
  status: string;
}

interface Trade {
  trade_id: string;
  user_id: string;
  other_user_id: string;
  order_id: string;
  other_order_id: string;
  quantity: number;
  price: number;
  base_asset: string;
  quote_asset: string;
  side: string;
}

interface Candle {
  candle_id: string;
  interval: string;
  base_asset: string;
  quote_asset: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Balance {
  id: string;
  user_id: string;
  asset: string;
  amount: number;
  type: string;
  ref_id: string;
}

interface Order {
  order_id: string;
  user_id: string;
  side: string;
  type: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  status: string;
  base_asset: string;
  quote_asset: string;
}

export { User, Transaction, Trade, Candle, Balance, Order };
