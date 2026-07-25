"use client";

import { useState, useEffect } from "react";
import { createOrder, getActiveUser } from "../utils/httpClient";
import { CONFIG } from "../config";
import { toast } from "react-hot-toast";

const SCALE = CONFIG.SATOSHI_SCALE;

export function SwapUI({ market }: { market: string }) {
  const [baseAsset, quoteAsset] = market.split("_");
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");

  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentUser(getActiveUser());

    const handleAuthChange = () => {
      setCurrentUser(getActiveUser());
    };

    window.addEventListener("auth_change", handleAuthChange);
    return () => {
      window.removeEventListener("auth_change", handleAuthChange);
    };
  }, []);

  const total = Number(price) * Number(quantity) || 0;

  const handleSubmit = async () => {
    console.log(currentUser, "user----------");
    if (!currentUser?.user_id) {
      toast.error("Please log in to place an order.");
      return;
    }

    if (!quantity || (type === "limit" && !price)) return;

    setIsSubmitting(true);
    try {
      let finalPrice = 0;
      let finalQuantity = 0;

      if (type === "limit") {
        finalPrice = Math.floor(Number(price) * SCALE);
        finalQuantity = Math.floor(Number(quantity) * SCALE);
      } else if (type === "market") {
        if (activeTab === "buy") {
          finalPrice = Math.floor(Number(quantity) * SCALE);
          finalQuantity = 0;
        } else {
          finalPrice = 0;
          finalQuantity = Math.floor(Number(quantity) * SCALE);
        }
      }

      await createOrder({
        user_id: currentUser.user_id,
        price: finalPrice,
        quantity: finalQuantity,
        side: activeTab,
        type: type,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset,
      });

      setPrice("");
      setQuantity("");
    } catch (error) {
      console.error("Error placing order:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMarketBuy = type === "market" && activeTab === "buy";
  const amountLabel = isMarketBuy ? "Total Budget" : "Quantity";
  const amountUnit = isMarketBuy ? quoteAsset : baseAsset;

  return (
    <div className="flex flex-col w-full bg-[#14151B] border border-slate-800/50 rounded-lg p-4">
      {/* Side Selector */}
      <div className="flex flex-row bg-[#0E1015] rounded-lg p-1 mb-4">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            activeTab === "buy"
              ? "bg-[#00C278] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            activeTab === "sell"
              ? "bg-[#F94D5C] text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="flex flex-row gap-4 mb-4 border-b border-slate-800/50 pb-2">
        {["limit", "market"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t as any)}
            className={`text-xs font-medium capitalize transition-colors ${
              type === t ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Order Entry Form */}
      <div className="flex flex-col gap-4">
        {/* Account Status Badge */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-normal text-slate-500">Account Context</p>
          <p className="font-medium text-xs text-slate-300 truncate max-w-[180px]">
            {currentUser
              ? currentUser.first_name ||
                currentUser.email ||
                currentUser.user_id
              : "Not Logged In"}
          </p>
        </div>

        {/* Price Input */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <p className="text-xs text-slate-500">Price</p>
          </div>
          <div className="flex relative items-center">
            <input
              type="number"
              placeholder="0"
              disabled={type === "market" || isSubmitting}
              value={type === "market" ? "" : price}
              onChange={(e) => setPrice(e.target.value)}
              className={`w-full h-11 rounded-lg bg-[#1E2026] px-3 text-left text-sm font-medium text-white placeholder-slate-600 transition outline-none border-none focus:ring-1 focus:ring-slate-700 ${
                type === "market" || isSubmitting
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            />
            <div className="absolute right-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {quoteAsset}
              </span>
            </div>
          </div>
        </div>

        {/* Quantity / Budget Input */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <p className="text-xs text-slate-500">{amountLabel}</p>
          </div>
          <div className="flex relative items-center">
            <input
              type="number"
              placeholder="0"
              disabled={isSubmitting}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`w-full h-11 rounded-lg bg-[#1E2026] px-3 text-left text-sm font-medium text-white placeholder-slate-600 transition outline-none border-none focus:ring-1 focus:ring-slate-700 ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
            <div className="absolute right-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {amountUnit}
              </span>
            </div>
          </div>
        </div>

        {/* Order Calculation */}
        <div className="flex justify-between items-center py-1">
          <p className="text-xs text-slate-500">Order Value</p>
          <p className="text-xs font-medium text-white">
            {type === "market" ? "--" : total.toFixed(2)}{" "}
            <span className="text-slate-500">{quoteAsset}</span>
          </p>
        </div>

        {/* Submit Execution Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !currentUser}
          className={`mt-2 font-semibold h-12 rounded-xl text-sm text-white active:scale-[0.98] transition-all outline-none flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
            !currentUser
              ? "bg-slate-800 text-slate-400 cursor-not-allowed"
              : activeTab === "buy"
              ? "bg-[#00C278] hover:bg-[#00a868]"
              : "bg-[#F94D5C] hover:bg-[#e04552]"
          }`}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : !currentUser ? (
            "Log In to Place Order"
          ) : activeTab === "buy" ? (
            `Buy ${baseAsset}`
          ) : (
            `Sell ${baseAsset}`
          )}
        </button>

        {/* Execution Flags */}
        <div className="flex flex-row gap-4 mt-2">
          {["Post Only", "IOC"].map((opt) => (
            <div
              key={opt}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                className="cursor-pointer h-3.5 w-3.5 accent-[#00C278] bg-[#1E2026] border-none rounded-sm"
                id={opt}
                type="checkbox"
              />
              <label
                htmlFor={opt}
                className="text-[11px] text-slate-500 group-hover:text-slate-300 cursor-pointer"
              >
                {opt}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
