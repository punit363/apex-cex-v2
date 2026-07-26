import fs from "fs";
import { CONFIG } from "../config/config.js";
import type { UserBalance } from "../types/index.js";

const SCALE = CONFIG.SCALE;

export class RiskService {
  private balances = new Map<string, UserBalance>();

  constructor() {
    this.loadSnapshot();
    this.startSnapshotTimer();
  }

  private loadSnapshot() {
    try {
      const balanceSnapshot = fs.readFileSync("./balanceSnapshot.json", "utf-8");
      const parsed = JSON.parse(balanceSnapshot);
      this.balances = new Map<string, UserBalance>(parsed.balances);
    } catch {
      console.log("ℹ️ No balance snapshot found, starting with clean ledger");
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

  public checkAndLockBalance(
    user_id: string,
    quantity: number,
    price: number,
    side: string,
    quoteAsset: string,
    baseAsset: string
  ): void {
    const userBalance = this.balances.get(user_id);
    if (!userBalance) {
      throw new Error(`CRITICAL: Ledger missing for user: ${user_id}`);
    }

    if (side === "buy") {
      if (!userBalance[quoteAsset]) {
        throw new Error(`CRITICAL: ${quoteAsset} ledger missing for user: ${user_id}. Add balance to ${quoteAsset}`);
      }
      const quoteValue = Math.floor((quantity * price) / SCALE);
      if (userBalance[quoteAsset].available < quoteValue) {
        throw new Error("Insufficient balance for buy order");
      }
      userBalance[quoteAsset].available -= quoteValue;
      userBalance[quoteAsset].locked += quoteValue;
    } else if (side === "sell") {
      if (!userBalance[baseAsset]) {
        throw new Error(`CRITICAL: ${baseAsset} ledger missing for user: ${user_id}. Add balance to ${baseAsset}`);
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
}

export const riskService = new RiskService();