type OrderData = {
  order_id?: string;
  price?: number;
  quantity?: number;
  side?: string;
  type?: string;
  baseAsset?: string;
  quoteAsset?: string;
};

type OrderRequestToEngine = {
  action: string;
  user_id: string;
  order_data: OrderData;
};

type UserData = {
  user_id: string;
  first_name: string;
  last_name: string;
  age: number;
  email: string;
  phone: string;
  password: string;
};

type BalanceUpdate = {
  tx_id?: string;
  asset?: string;
  type?: string;
  amount?: number;
};

type BalanceRequestToEngine = {
  action: string;
  user_id: string;
  transaction_data?: BalanceUpdate;
};

type UserRequestToEngine = {
  user_id: string;
  asset?: string;
  amount?: number;
};

type MarketRequestToEngine = {
  action: string;
  user_id?: string;
};

type EngineRequest = {
  type: string;
  order?: OrderRequestToEngine;
  transaction?: BalanceRequestToEngine;
  user?: UserRequestToEngine;
  market?: MarketRequestToEngine;
};

type EngineResponse = {
  data?: any;
  eng_status_code: number;
  status: "SUCCESS" | "FAILED";
  message: string;
};

export {
  OrderRequestToEngine,
  UserData,
  BalanceUpdate,
  BalanceRequestToEngine,
  EngineRequest,
  EngineResponse,
};
