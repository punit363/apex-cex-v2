"use client";

import { useEffect, useRef, useState } from "react";
import { ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine } from "../utils/types";
import { wsClient } from "../utils/wsClient";
import { CONFIG } from "../config";

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"];
const SCALE = CONFIG.SATOSHI_SCALE;

export function KlineChart({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);

  const [activeInterval, setActiveInterval] = useState("1m");

  const getLookbackWindow = (interval: string) => {
    const now = new Date().getTime();
    switch (interval) {
      case "1m":
        return now - 1000 * 60 * 60 * 1;
      case "5m":
        return now - 1000 * 60 * 60 * 3;
      case "15m":
        return now - 1000 * 60 * 60 * 24;
      case "1h":
        return now - 1000 * 60 * 60 * 24 * 3;
      case "1d":
        return now - 1000 * 60 * 60 * 24 * 150;
      default:
        return now - 1000 * 60 * 60 * 1;
    }
  };

  const handleScrollLeft = () => {
    const chart = chartManagerRef.current;
    if (!chart) return;
    chart.scrollLeft(20);
  };

  const handleScrollRight = () => {
    const chart = chartManagerRef.current;
    if (!chart) return;
    chart.scrollRight(20);
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      let klineData: KLine[] = [];

      const endTime = Math.floor(new Date().getTime() / 1000);
      const startTime = Math.floor(getLookbackWindow(activeInterval) / 1000);

      try {
        klineData = await getKlines(market, activeInterval, startTime, endTime);
      } catch (e) {
        console.error("Failed to fetch klines", e);
      }

      if (!isMounted) return;

      if (chartRef.current) {
        if (chartManagerRef.current) {
          chartManagerRef.current.destroy();
          chartManagerRef.current = null;
        }

        const formattedKlines = (klineData || [])
          .map((x) => {
            const timestampMs = Number(x.end);
            return {
              close: parseFloat(x.close) / SCALE,
              high: parseFloat(x.high) / SCALE,
              low: parseFloat(x.low) / SCALE,
              open: parseFloat(x.open) / SCALE,
              timestamp: new Date(timestampMs),

              time: Math.floor(timestampMs / 1000),
            };
          })
          .sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());

        const chartOptions = {
          background: "#0e0f14",
          color: "white",

          timeScale: {
            secondsVisible: false,
          },
        };

        const chartManager = new ChartManager(
          chartRef.current,
          formattedKlines,
          chartOptions,
          activeInterval
        );

        const rawChart =
          (chartManager as any).chart || (chartManager as any)._chart;
        if (rawChart && typeof rawChart.applyOptions === "function") {
          rawChart.applyOptions({
            timeScale: {
              timeVisible: activeInterval !== "1d",
              secondsVisible: false,
            },
          });
        }

        chartManagerRef.current = chartManager;
      }
    };

    init();
    wsClient.connect();

    const handleTradeUpdate = (data: any) => {
      if (!isMounted || !chartManagerRef.current) return;

      const fillList = Array.isArray(data)
        ? data
        : data.trade || data.data || [];

      if (Array.isArray(fillList) && fillList.length > 0) {
        const latestPrice = Number(fillList[0].price) / SCALE;
        const tradeTime = fillList[0].bucketTime || Date.now();

        chartManagerRef.current.updateLivePrice(latestPrice, tradeTime);
      }
    };

    wsClient.subscribe(market, "TRADE", handleTradeUpdate);

    return () => {
      isMounted = false;
      wsClient.unsubscribe(market, "TRADE", handleTradeUpdate);
      if (chartManagerRef.current) {
        chartManagerRef.current.destroy();
        chartManagerRef.current = null;
      }
    };
  }, [market, activeInterval]);

  return (
    <div className="flex flex-col flex-1 h-full bg-[#0e0f14]">
      <div className="flex flex-row items-center justify-between px-4 py-2 border-b border-slate-800">
        <div className="flex flex-row gap-2">
          {INTERVALS.map((interval) => (
            <button
              key={interval}
              onClick={() => setActiveInterval(interval)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeInterval === interval
                  ? "bg-slate-800 text-blue-500 font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {interval}
            </button>
          ))}

          <div className="w-px bg-slate-700 mx-1" />

          <button
            onClick={handleScrollLeft}
            title="Scroll left"
            className="px-3 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            ←
          </button>
          <button
            onClick={handleScrollRight}
            title="Scroll right"
            className="px-3 py-1 text-xs rounded text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            →
          </button>
        </div>

        <div className="flex items-center text-slate-500 hover:text-white cursor-pointer px-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <div ref={chartRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
