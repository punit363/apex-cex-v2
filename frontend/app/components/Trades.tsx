"use client";

import { useEffect, useState } from "react";
import { wsClient } from "../utils/wsClient";
import { getTrades } from "../utils/httpClient";
import { CONFIG } from "../config";

const SCALE = CONFIG.SATOSHI_SCALE;

interface TradeEvent {
  tradeId: string;
  price: string | number;
  quantity: string | number;
  bucketTime: number;
  isBuyerMaker?: boolean;
}

export function Trades({ market }: { market: string }) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);

  useEffect(() => {
    let isMounted = true;


    getTrades(market)
      .then((initialTrades: any[]) => {
        if (isMounted && Array.isArray(initialTrades)) {
          const formattedTrades = initialTrades.map((t) => ({
            tradeId: t.tradeId || t.id || t.uuid || Math.random().toString(),
            price: t.price / SCALE,
            quantity:
              t.quantity / SCALE || t.qty / SCALE || t.size / SCALE || "0",
            bucketTime: t.bucketTime || t.timestamp || t.time || Date.now(),
            isBuyerMaker: t.isBuyerMaker,
          }));

          setTrades(formattedTrades.slice(0, 50));
        }
      })
      .catch((err) => console.error("Failed to fetch initial trades", err));

    wsClient.connect();

    const handleTradeUpdate = (data: any) => {

      const fills = data.trade || data;


      if (!isMounted || !Array.isArray(fills) || fills.length === 0) return;

      setTrades((prevTrades) => {
        const formattedFills = fills.map((fill) => ({
          tradeId: fill.tradeId || fill.id || Math.random().toString(),
          price: fill.price / SCALE,
          quantity: fill.quantity / SCALE || fill.size / SCALE,
          bucketTime: fill.bucketTime || fill.timestamp || Date.now(),
          isBuyerMaker: fill.isBuyerMaker,
        }));

        const merged = [...formattedFills, ...prevTrades];
        return merged.slice(0, 50);
      });
    };

    wsClient.subscribe(market, "TRADE", handleTradeUpdate);

    return () => {
      isMounted = false;
      wsClient.unsubscribe(market, "TRADE", handleTradeUpdate);
    };
  }, [market]);

  return (
    <div className="flex flex-col h-full w-full bg-[#14151B]">

      <div className="flex justify-between px-3 py-1 mt-1 text-xs font-medium text-slate-500 border-b border-slate-800/50">
        <div className="w-1/3 text-left">Price</div>
        <div className="w-1/3 text-right">Size</div>
        <div className="w-1/3 text-right">Time</div>
      </div>


      <div className="flex-1 overflow-y-auto no-scrollbar pt-1">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-slate-500 font-sans text-xs">
            Waiting for trades...
          </div>
        ) : (
          trades.map((trade, index) => {
            const timeString = new Date(trade.bucketTime).toLocaleTimeString(
              [],
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }
            );


            const isBuy = trade.isBuyerMaker === false;
            const priceColor =
              trade.isBuyerMaker !== undefined
                ? isBuy
                  ? "text-[#00C278]"
                  : "text-[#F94D5C]"
                : "text-white";

            return (
              <div

                key={`${trade.tradeId}-${index}`}
                className="flex justify-between px-3 py-[3px] text-[11px] tabular-nums hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className={`w-1/3 text-left ${priceColor}`}>
                  {Number(trade.price).toFixed(2)}
                </div>
                <div className="w-1/3 text-right text-slate-300">
                  {Number(trade.quantity).toFixed(4)}
                </div>
                <div className="w-1/3 text-right text-slate-500">
                  {timeString}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
