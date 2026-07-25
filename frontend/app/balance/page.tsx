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

const SCALE = CONFIG.SATOSHI_SCALE;

interface AssetBalance {
  available: number;
  locked: number;
}

interface UserBalances {
  [asset: string]: AssetBalance;
}

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

    if (cachedBalances) setBalances(JSON.parse(cachedBalances));
    if (cachedAssets) setAssets(JSON.parse(cachedAssets));

    setCurrentUser(getActiveUser());
    loadRequiredData();
  }, []);

  const loadRequiredData = async () => {
    try {
      const [balanceRes, assetList] = await Promise.allSettled([
        getUserBalance(getActiveUser()?.user_id),
        getAssets(),
      ]);

      if (
        balanceRes.status === "fulfilled" &&
        balanceRes.value?.status === "SUCCESS"
      ) {
        setBalances(balanceRes.value.data);
        localStorage.setItem(
          "cached_balances",
          JSON.stringify(balanceRes.value.data)
        );
      }

      if (assetList.status === "fulfilled" && Array.isArray(assetList.value)) {
        setAssets(assetList.value);
        localStorage.setItem("cached_assets", JSON.stringify(assetList.value));
        if (assetList.value.length > 0 && !selectedAsset)
          setSelectedAsset(assetList.value[0]);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(amountInput);
    if (isNaN(amountVal) || amountVal <= 0)
      return toast.error("Enter a valid amount.");

    setIsSubmitting(true);
    try {
      const response = await updateUserBalance({
        user_id: currentUser.user_id,
        amount: Math.floor(amountVal * SCALE),
        asset: selectedAsset,
        type: modalType,
      });

      if (response?.status === "SUCCESS") {
        toast.success(`${modalType} successful!`);
        setBalances(response.data.current_balance || response.data);
        setIsModalOpen(false);
        setAmountInput("");
      }
    } catch {
      toast.error("Transaction failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getINRValue = (asset: string, qty: number) => {
    const rates: { [key: string]: number } = {
      INR: 1,
      BTC: 8900000,
      ETH: 260000,
      SOL: 14500,
      XRP: 210,
      ADA: 85,
      DOGE: 35,
    };
    return (qty / SCALE) * (rates[asset] || 1);
  };

  const totalPortfolioValue = Object.keys(balances).reduce((sum, asset) => {
    const bal = balances[asset] || { available: 0, locked: 0 };
    return sum + getINRValue(asset, bal.available + bal.locked);
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
                className="h-11 rounded-lg bg-[#00C278] hover:bg-[#00a868] text-white text-xs font-bold uppercase"
              >
                Deposit
              </button>
              <button
                onClick={() => {
                  setModalType("withdraw");
                  setIsModalOpen(true);
                }}
                className="h-11 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase"
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
                  return (
                    <tr key={asset} className="hover:bg-slate-900/10">
                      <td className="px-6 py-4 font-bold text-slate-200">
                        {asset}
                      </td>
                      <td className="px-6 py-4 text-right text-[#00C278] font-mono">
                        {(bal.available / SCALE).toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-400 font-mono">
                        {(bal.locked / SCALE).toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-white">
                        {((bal.available + bal.locked) / SCALE).toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300 font-mono">
                        $
                        {getINRValue(
                          asset,
                          bal.available + bal.locked
                        ).toLocaleString()}
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
                    d="M6 18L18 6M6 6l12 12"
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
