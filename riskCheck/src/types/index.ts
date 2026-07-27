interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

type Transaction = {
  tx_id: string;
  user_id: string;
  asset: string;
  type: string;
  amount: number;
};

export type { UserBalance, Transaction };
