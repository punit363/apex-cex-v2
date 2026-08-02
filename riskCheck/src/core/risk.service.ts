import fs from "fs";
import { CONFIG } from "../config/config.js";
import type { Transaction, UserBalance } from "../types/index.js";
import RedisHandler from "../redis.js";

const SCALE = CONFIG.SCALE;

export class RiskService {
  private balances = new Map<string, UserBalance>();

  constructor() {
    this.loadSnapshot();
    this.startSnapshotTimer();
  }

  private loadSnapshot() {
    try {
      const balanceSnapshot = fs.readFileSync(
        "./balanceSnapshot.json",
        "utf-8"
      );
      const parsed = JSON.parse(balanceSnapshot);

      this.balances = new Map<string, UserBalance>(parsed.balances);
    } catch (err) {
      console.log(
        "ℹ️ No balance snapshot found, starting with clean ledger",
        err
      );
    }
  }

  private startSnapshotTimer() {
    setInterval(() => {
      const snapshot = {
        balances: Array.from(this.balances.entries()),
      };
      fs.writeFileSync("./balanceSnapshot.json", JSON.stringify(snapshot));
    }, 3000);
  }

  private addTransactionInDB = async (transaction: Transaction) => {
    const redis = await RedisHandler.createInstance();
    await redis.sendToDB({
      action: "ADD_TRANSACTION",
      transaction,
    });
  };

  public checkAndLockBalance(
    user_id: string,
    quantity: number,
    price: number,
    side: string,
    quoteAsset: string,
    baseAsset: string
  ): void {
    console.log(user_id, "+++++++++++");
    const userBalance = this.balances.get(user_id);
    if (!userBalance) {
      throw new Error(`CRITICAL: Ledger missing for user: ${user_id}`);
    }

    if (side === "buy") {
      if (!userBalance[quoteAsset]) {
        throw new Error(
          `CRITICAL: ${quoteAsset} ledger missing for user: ${user_id}. Add balance to ${quoteAsset}`
        );
      }
      const quoteValue = Math.floor((quantity * price) / SCALE);
      if (userBalance[quoteAsset].available < quoteValue) {
        throw new Error("Insufficient balance for buy order");
      }
      userBalance[quoteAsset].available -= quoteValue;
      userBalance[quoteAsset].locked += quoteValue;
    } else if (side === "sell") {
      if (!userBalance[baseAsset]) {
        throw new Error(
          `CRITICAL: ${baseAsset} ledger missing for user: ${user_id}. Add balance to ${baseAsset}`
        );
      }
      if (userBalance[baseAsset].available < quantity) {
        throw new Error("Insufficient balance for sell order");
      }
      userBalance[baseAsset].available -= quantity;
      userBalance[baseAsset].locked += quantity;
    }
  }

  public unlockBalance(
    user_id: string,
    quantity: number,
    price: number,
    side: string,
    quoteAsset: string,
    baseAsset: string
  ): void {
    const userBalance = this.balances.get(user_id);
    if (!userBalance) return;

    if (side === "buy" && userBalance[quoteAsset]) {
      const quoteValue = Math.floor((quantity * price) / SCALE);
      userBalance[quoteAsset].locked -= quoteValue;
      userBalance[quoteAsset].available += quoteValue;
    } else if (side === "sell" && userBalance[baseAsset]) {
      userBalance[baseAsset].locked -= quantity;
      userBalance[baseAsset].available += quantity;
    }
  }

  public async updateBalance(
    user_id: string,
    tx_id: string,
    asset: string,
    type: string,
    amount: number
  ) {
    try {
      const user_balance: UserBalance | any = this.balances.get(user_id);

      if (!user_balance) {
        throw new Error(`User balance not found for user_id: ${user_id}`);
      }

      if (!user_balance[asset]) {
        user_balance[asset] = { available: 0, locked: 0 };
      }

      if (type === "deposit") {
        user_balance[asset].available += amount;
      } else if (type === "withdraw") {
        if (user_balance[asset].available < amount) {
          throw new Error("You do not have sufficient balance");
        }
        user_balance[asset].available -= amount;
      } else {
        throw new Error(
          "Invalid transaction type or user balance does not exist"
        );
      }

      this.addTransactionInDB({
        tx_id,
        user_id,
        asset,
        type,
        amount,
      }).catch((err) => {
        console.error(
          `Non-Blocking DB Logging Error for tx ${tx_id}:`,
          err.message
        );
      });

      this.balances.set(user_id, user_balance);
    } catch (error: any) {
      console.error("Engine BALANCE_UPDATE_ERROR Intercepted: ", error.message);
    }
  }

  public settleBalanceAfterTrade = (trade: any) => {
    const {
      user_id,
      market,
      quantity,
      price,
      trade_id,
      order_id,
      filled,
      status,
      side,
      unsold_market_order_quanity,
      unused_market_order_amount,
    } = trade;

    const [baseAsset, quoteAsset] = market.split("_");

    if (side === "sell") {
      const userBalance = this.balances.get(user_id);

      if (!userBalance) {
        throw new Error(`Balance missing for user: ${user_id}`);
      }
      if (!userBalance[baseAsset] || !userBalance[quoteAsset]) {
        throw new Error(
          `Specific asset ledger missing during settleBalanceAfterTrade`
        );
      }

      const quoteValue = Math.floor((filled * price) / SCALE);

      userBalance[baseAsset].locked -=
        filled + unsold_market_order_quanity ? unsold_market_order_quanity : 0;
      userBalance[quoteAsset].available += quoteValue;
    } else if (side === "buy") {
      const userBalance = this.balances.get(user_id);

      if (!userBalance) {
        throw new Error(`Balance missing for user: ${user_id}`);
      }
      if (!userBalance[baseAsset] || !userBalance[quoteAsset]) {
        throw new Error(
          `Specific asset ledger missing during settleBalanceAfterTrade`
        );
      }

      const quoteValue = Math.floor((filled * price) / SCALE);

      userBalance[quoteAsset].locked -=
        quoteValue + unused_market_order_amount
          ? unused_market_order_amount
          : 0;
      userBalance[baseAsset].available += filled;
    } else {
      throw new Error("Order side must be buy or sell");
    }
  };
}

export const riskService = new RiskService();
