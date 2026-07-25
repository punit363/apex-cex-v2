"use client";

import { useEffect, useState, useMemo } from "react";
import { wsClient } from "@/app/utils/wsClient";
import { getDepth } from "@/app/utils/httpClient";
import { CONFIG } from "@/app/config";

const SCALE = CONFIG.SATOSHI_SCALE;

export function Depth({ market }: { market: string }) {
  const [bids, setBids] = useState<[string, string][]>([]);
  const [asks, setAsks] = useState<[string, string][]>([]);
  const [price, setPrice] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    getDepth(market)
      .then((data) => {
        if (!isMounted) return;

        if (data.currentPrice) setPrice(data.currentPrice.toString());

        if (data.bids) {
          const newBids = Object.entries(data.bids)
            .map(([p, s]) => [p, String(s)] as [string, string])
            .filter(([_, s]) => Number(s) > 0)
            .sort((a, b) => Number(b[0]) - Number(a[0]));
          setBids(newBids);
        }

        if (data.asks) {
          const newAsks = Object.entries(data.asks)
            .map(([p, s]) => [p, String(s)] as [string, string])
            .filter(([_, s]) => Number(s) > 0)
            .sort((a, b) => Number(a[0]) - Number(b[0]));
          setAsks(newAsks);
        }
      })
      .catch((err) => console.error("Failed to fetch initial depth", err));

    const handleBookUpdate = (data: any) => {
      if (!isMounted) return;

      const rawBids = data.bids || data.book?.bids || data.data?.bids;
      const rawAsks = data.asks || data.book?.asks || data.data?.asks;

      if (rawBids) {
        const sortedBids = Object.entries(rawBids)
          .map(([p, s]) => [p, String(s)] as [string, string])

          .filter(([_, s]) => Number(s) > 0)
          .sort((a, b) => Number(b[0]) - Number(a[0]));
        setBids(sortedBids);
      }

      if (rawAsks) {
        const sortedAsks = Object.entries(rawAsks)
          .map(([p, s]) => [p, String(s)] as [string, string])

          .filter(([_, s]) => Number(s) > 0)
          .sort((a, b) => Number(a[0]) - Number(b[0]));
        setAsks(sortedAsks);
      }
    };

    const handleTradeUpdate = (fills: any) => {
      if (!isMounted) return;

      const fillList = Array.isArray(fills)
        ? fills
        : fills.trade || fills.data || [];
      if (Array.isArray(fillList) && fillList.length > 0 && fillList[0].price) {
        setPrice(fillList[0].price.toString());
      }
    };

    wsClient.connect();
    wsClient.subscribe(market, "BOOK", handleBookUpdate);
    wsClient.subscribe(market, "TRADE", handleTradeUpdate);

    return () => {
      isMounted = false;
      wsClient.unsubscribe(market, "BOOK", handleBookUpdate);
      wsClient.unsubscribe(market, "TRADE", handleTradeUpdate);
    };
  }, [market]);

  const processLevels = (levels: [string, string][]) => {
    let total = 0;
    return levels.map(([priceStr, quantityStr]) => {
      const rawPrice = Number(priceStr);
      const rawQty = Number(quantityStr);
      total += rawQty;

      return {
        rawPrice,
        rawQty,
        rawTotal: total,
        price: (rawPrice / SCALE).toFixed(2),
        quantity: (rawQty / SCALE).toFixed(4),
        totalFormatted: (total / SCALE).toFixed(4),
      };
    });
  };

  const bidsWithTotal = useMemo(
    () => processLevels(bids?.slice(0, 15) || []),
    [bids]
  );
  const asksWithTotal = useMemo(
    () => processLevels(asks?.slice(0, 15) || []).reverse(),
    [asks]
  );

  const maxTotal = Math.max(
    asksWithTotal[0]?.rawTotal || 0,
    bidsWithTotal[bidsWithTotal.length - 1]?.rawTotal || 0
  );

  const highestBid = bidsWithTotal.length > 0 ? bidsWithTotal[0].rawPrice : 0;
  const lowestAsk =
    asksWithTotal.length > 0
      ? asksWithTotal[asksWithTotal.length - 1].rawPrice
      : 0;
  const actualSpread =
    lowestAsk > 0 && highestBid > 0
      ? ((lowestAsk - highestBid) / SCALE).toFixed(2)
      : "--";

  return (
    <div className="flex flex-col w-full h-full bg-[#14151B] border-none font-mono text-[11px] select-none">
      <div className="flex flex-row justify-between text-slate-500 px-3 py-1">
        <div className="flex-1 text-left">Price</div>
        <div className="flex-1 text-right">Size</div>
        <div className="flex-1 text-right">Total</div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden justify-end pb-1">
        {asksWithTotal.map((ask) => {
          const barWidth = maxTotal > 0 ? (ask.rawTotal / maxTotal) * 100 : 0;
          return (
            <div
              key={`ask-${ask.rawPrice}`}
              className="relative flex flex-row justify-between px-3 py-[2px] hover:bg-slate-800/50 cursor-pointer group animate-fade-in"
            >
              <div
                className="absolute right-0 top-0 h-full bg-[#F94D5C]/10 transition-all duration-350"
                style={{ width: `${barWidth}%` }}
              />
              <div className="flex-1 text-left text-[#F94D5C] tabular-nums z-10">
                {ask.price}
              </div>
              <div className="flex-1 text-right text-slate-300 tabular-nums z-10">
                {ask.quantity}
              </div>
              <div className="flex-1 text-right text-slate-500 group-hover:text-slate-400 tabular-nums z-10">
                {ask.totalFormatted}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-3 py-2 my-1 border-y border-slate-800/40 bg-[#0E1015]/50">
        <span
          className={`text-[15px] font-semibold ${
            price ? "text-[#00C278]" : "text-slate-500"
          }`}
        >
          {price ? (Number(price) / SCALE).toFixed(2) : "--"}
        </span>
        <span className="text-xs text-slate-500">Spread: {actualSpread}</span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden pt-1">
        {bidsWithTotal.map((bid) => {
          const barWidth = maxTotal > 0 ? (bid.rawTotal / maxTotal) * 100 : 0;
          return (
            <div
              key={`bid-${bid.rawPrice}`}
              className="relative flex flex-row justify-between px-3 py-[2px] hover:bg-slate-800/50 cursor-pointer group animate-fade-in"
            >
              <div
                className="absolute right-0 top-0 h-full bg-[#00C278]/10 transition-all duration-350"
                style={{ width: `${barWidth}%` }}
              />
              <div className="flex-1 text-left text-[#00C278] tabular-nums z-10">
                {bid.price}
              </div>
              <div className="flex-1 text-right text-slate-300 tabular-nums z-10">
                {bid.quantity}
              </div>
              <div className="flex-1 text-right text-slate-500 group-hover:text-slate-400 tabular-nums z-10">
                {bid.totalFormatted}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
