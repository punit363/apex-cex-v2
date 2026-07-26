interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

export type { UserBalance };
