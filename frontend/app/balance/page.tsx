"use client";

import React, { useState, useEffect } from "react";
import { AuthGuard } from "../components/AuthGuard";
import {
  getActiveUser,
  getUserBalance,
  updateUserBalance,
  getAssets,
} from "../utils/httpClient";
import { toast } from "react-hot-toast";
import { CONFIG } from "../config";

const SCALE = CONFIG.SATOSHI_SCALE || 100000000;

interface AssetBalance {
  available: number | string;
  locked: number | string;
}

interface UserBalances {
  [asset: string]: AssetBalance;
}

// Safe Satoshi-to-Unit Float Conversion
const toUnits = (val: string | number | undefined): number => {
  if (val === undefined || val === null) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num / SCALE;
};

// Safe Satoshi Raw Value Parser
const toRawNumber = (val: string | number | undefined): number => {
  if (val === undefined || val === null) return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

export default function BalancePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [balances, setBalances] = useState<UserBalances>({});
  const [assets, setAssets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"deposit" | "withdraw">("deposit");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const cachedBalances = localStorage.getItem("cached_balances");
    const cachedAssets = localStorage.getItem("cached_assets");

    if (cachedBalances) {
      try {
        setBalances(JSON.parse(cachedBalances));
      } catch {}
    }
    if (cachedAssets) {
      try {
        setAssets(JSON.parse(cachedAssets));
      } catch {}
    }

    const user = getActiveUser();
    setCurrentUser(user);
    loadRequiredData(user);
  }, []);

  const loadRequiredData = async (userContext?: any) => {
    try {
      const activeUser = userContext || getActiveUser();

      // Resolve user_id across common property naming variants
      const userId =
        activeUser?.user_id ||
        activeUser?.id ||
        activeUser?.userId ||
        activeUser?.user?.user_id;

      console.log("🔍 Fetching balances for resolved User ID:", userId);

      const [balanceRes, assetList] = await Promise.allSettled([
        userId ? getUserBalance(userId) : Promise.reject("No user_id found"),
        getAssets(),
      ]);

      // 1. Process & Sanitize Balances
      if (balanceRes.status === "fulfilled" && balanceRes.value) {
        const res = balanceRes.value;
        // Unwrap data defensively across different response wrappers
        const balanceData =
          res.data?.balances || res.data || res.balances || res;

        if (balanceData && typeof balanceData === "object") {
          console.log("✅ Successfully received balance data:", balanceData);
          setBalances(balanceData);
          localStorage.setItem("cached_balances", JSON.stringify(balanceData));
        }
      } else {
        console.warn("⚠️ Balance fetch failed or unfulfilled:", balanceRes);
      }

      // 2. Process Assets List
      let fetchedAssets: string[] = [];
      if (
        assetList.status === "fulfilled" &&
        Array.isArray(assetList.value) &&
        assetList.value.length > 0
      ) {
        fetchedAssets = assetList.value;
      } else {
        // Fallback default assets if assets endpoint is unavailable
        fetchedAssets = ["BTC", "USDT", "ETH", "SOL"];
      }

      // Ensure any assets present in balanceData are also included in the table
      const cached = localStorage.getItem("cached_balances");
      const activeBalances = cached ? JSON.parse(cached) : {};
      const combinedAssets = Array.from(
        new Set([...fetchedAssets, ...Object.keys(activeBalances)])
      );

      setAssets(combinedAssets);
      localStorage.setItem("cached_assets", JSON.stringify(combinedAssets));

      if (combinedAssets.length > 0 && !selectedAsset) {
        setSelectedAsset(combinedAssets[0]);
      }
    } catch (error) {
      console.error("❌ Error in loadRequiredData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(amountInput);
    if (isNaN(amountVal) || amountVal <= 0)
      return toast.error("Enter a valid amount.");

    const userId =
      currentUser?.user_id ||
      currentUser?.id ||
      currentUser?.userId ||
      getActiveUser()?.user_id;

    if (!userId) return toast.error("User context missing. Please re-login.");

    setIsSubmitting(true);
    try {
      const response = await updateUserBalance({
        user_id: userId,
        amount: Math.floor(amountVal * SCALE),
        asset: selectedAsset,
        type: modalType,
      });

      if (response?.status === "SUCCESS" || response?.success) {
        toast.success(`${modalType} successful!`);
        const updated =
          response.data?.current_balance ||
          response.data?.balances ||
          response.data ||
          response.balances;

        if (updated) {
          setBalances(updated);
          localStorage.setItem("cached_balances", JSON.stringify(updated));
        } else {
          loadRequiredData(currentUser);
        }
        setIsModalOpen(false);
        setAmountInput("");
      } else {
        toast.error(response?.message || "Transaction failed.");
      }
    } catch {
      toast.error("Transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getINRValue = (asset: string, totalSatoshiUnits: number) => {
    const rates: { [key: string]: number } = {
      INR: 1,
      USDT: 85,
      BTC: 8900000,
      ETH: 260000,
      SOL: 14500,
      XRP: 210,
      ADA: 85,
      DOGE: 35,
    };
    return (totalSatoshiUnits / SCALE) * (rates[asset] || 1);
  };

  const totalPortfolioValue = Object.keys(balances).reduce((sum, asset) => {
    const bal = balances[asset] || { available: 0, locked: 0 };
    const totalSatoshi = toRawNumber(bal.available) + toRawNumber(bal.locked);
    return sum + getINRValue(asset, totalSatoshi);
  }, 0);

  return (
    <AuthGuard>
      <main className="min-h-screen w-full bg-[#0E1015] text-white flex flex-col font-sans select-none pb-12">
        <section className="max-w-7xl w-full mx-auto px-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 bg-[#14151B] border border-slate-900 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#00C278]/5 rounded-full blur-3xl" />
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
              Portfolio Value
            </p>
            <h1 className="text-3xl font-extrabold text-white mt-2 tabular-nums">
              $
              {totalPortfolioValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h1>
          </div>

          <div className="bg-[#14151B] border border-slate-900 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Adjust Balances
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3.5 mt-4">
              <button
                onClick={() => {
                  setModalType("deposit");
                  setIsModalOpen(true);
                }}
                className="h-11 rounded-lg bg-[#00C278] hover:bg-[#00a868] text-white text-xs font-bold uppercase transition"
              >
                Deposit
              </button>
              <button
                onClick={() => {
                  setModalType("withdraw");
                  setIsModalOpen(true);
                }}
                className="h-11 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase transition"
              >
                Withdraw
              </button>
            </div>
          </div>
        </section>

        <section className="max-w-7xl w-full mx-auto px-6 mt-8">
          <div className="bg-[#14151B] border border-slate-900 rounded-xl overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-900 text-[10px] uppercase font-bold text-slate-500">
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4 text-right">Available</th>
                  <th className="px-6 py-4 text-right">Locked</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Value (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60">
                {assets.map((asset) => {
                  const bal = balances[asset] || { available: 0, locked: 0 };
                  const availUnits = toUnits(bal.available);
                  const lockedUnits = toUnits(bal.locked);
                  const totalUnits = availUnits + lockedUnits;
                  const totalSatoshiRaw =
                    toRawNumber(bal.available) + toRawNumber(bal.locked);

                  return (
                    <tr key={asset} className="hover:bg-slate-900/10">
                      <td className="px-6 py-4 font-bold text-slate-200">
                        {asset}
                      </td>
                      <td className="px-6 py-4 text-right text-[#00C278] font-mono">
                        {availUnits.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400 font-mono">
                        {lockedUnits.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-white">
                        {totalUnits.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300 font-mono">
                        $
                        {getINRValue(asset, totalSatoshiRaw).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#14151B] border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6"
                  />
                </svg>
              </button>
              <h2 className="text-xl font-bold mb-1 capitalize">
                {modalType} {selectedAsset}
              </h2>
              <p className="text-slate-500 text-xs mb-6">
                Transfer assets to your engine ledger.
              </p>
              <form
                onSubmit={handleTransactionSubmit}
                className="flex flex-col gap-4"
              >
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="w-full bg-[#1E2026] h-12 rounded-xl px-4 text-sm text-white outline-none"
                >
                  {assets.map((asset) => (
                    <option key={asset} value={asset}>
                      {asset}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="Amount"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-[#1E2026] h-12 rounded-xl px-4 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-[#00C278] hover:bg-[#00a868] text-white font-bold rounded-xl transition"
                >
                  Confirm
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
