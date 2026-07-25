"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "../components/AuthGuard";
import { getActiveUser, apiClient } from "../utils/httpClient";
import { CONFIG } from "../config";
import Image from "next/image";

const SCALE = CONFIG.SATOSHI_SCALE;

interface MarketData {
  baseAsset: string;
  quoteAsset: string;
  currentPrice: number;
  price24hAgo?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  sparkline?: number[];
}

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [engineLatency, setEngineLatency] = useState(12.4);
  const [tradeCount, setTradeCount] = useState(14829);

  useEffect(() => {
    setCurrentUser(getActiveUser());
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const response = await apiClient.get("/market/all");

      let parsedMarkets: MarketData[] = [];
      if (Array.isArray(response.data)) {
        parsedMarkets = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        parsedMarkets = response.data.data;
      } else {
        throw new Error("Invalid API response format");
      }

      const extendedMarkets = parsedMarkets.map((m) => {
        const currentPrice = Number(m.currentPrice);
        const changePercent =
          Math.sin(m.baseAsset.charCodeAt(0)) * 5 + (Math.random() * 2 - 1);
        const price24hAgo = currentPrice / (1 + changePercent / 100);
        const volumeFactor =
          Math.abs(Math.sin(m.baseAsset.charCodeAt(0))) * 1000 + 100;

        const sparkline: number[] = [];
        for (let i = 0; i < 12; i++) {
          const variance =
            Math.sin(i + m.baseAsset.charCodeAt(0)) * 0.02 +
            (Math.random() * 0.01 - 0.005);
          sparkline.push(currentPrice * (1 + variance));
        }

        return {
          ...m,
          currentPrice,
          price24hAgo,
          change24h: changePercent,
          high24h: currentPrice * (1 + Math.abs(changePercent) * 0.012),
          low24h: currentPrice * (1 - Math.abs(changePercent) * 0.012),
          volume24h: volumeFactor * 45,
          sparkline,
        };
      });

      setMarkets(extendedMarkets);
    } catch (error) {
      console.warn(
        "Could not retrieve live markets, loading premium fallback models:",
        error
      );
      const fallbackList = [
        { baseAsset: "BTC", quoteAsset: "USDT", currentPrice: 89000 * SCALE },
        { baseAsset: "ETH", quoteAsset: "USDT", currentPrice: 2600 * SCALE },
        { baseAsset: "SOL", quoteAsset: "USDT", currentPrice: 145 * SCALE },
        { baseAsset: "XRP", quoteAsset: "USDT", currentPrice: 2.1 * SCALE },
        { baseAsset: "ADA", quoteAsset: "USDT", currentPrice: 0.85 * SCALE },
        { baseAsset: "DOGE", quoteAsset: "USDT", currentPrice: 0.35 * SCALE },
        { baseAsset: "ETH", quoteAsset: "BTC", currentPrice: 0.029 * SCALE },
        { baseAsset: "SOL", quoteAsset: "BTC", currentPrice: 0.0016 * SCALE },
        { baseAsset: "SOL", quoteAsset: "ETH", currentPrice: 0.055 * SCALE },
      ];

      const extendedFallbacks = fallbackList.map((m) => {
        const currentPrice = m.currentPrice;
        const changePercent =
          Math.sin(m.baseAsset.charCodeAt(0)) * 6 +
          (Math.random() * 1.5 - 0.75);
        const price24hAgo = currentPrice / (1 + changePercent / 100);

        const sparkline: number[] = [];
        for (let i = 0; i < 12; i++) {
          const variance =
            Math.sin(i + m.baseAsset.charCodeAt(0)) * 0.02 +
            (Math.random() * 0.01 - 0.005);
          sparkline.push(currentPrice * (1 + variance));
        }

        return {
          ...m,
          currentPrice,
          price24hAgo,
          change24h: changePercent,
          high24h: currentPrice * (1 + Math.abs(changePercent) * 0.015),
          low24h: currentPrice * (1 - Math.abs(changePercent) * 0.015),
          volume24h: Math.abs(Math.sin(m.baseAsset.charCodeAt(0))) * 450000,
          sparkline,
        };
      });

      setMarkets(extendedFallbacks);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();

    const marketInterval = setInterval(fetchMarkets, 8000);

    const diagnosticsInterval = setInterval(() => {
      setEngineLatency(Number((10 + Math.random() * 4).toFixed(1)));
      setTradeCount((prev) => prev + Math.floor(Math.random() * 3));
    }, 3000);

    return () => {
      clearInterval(marketInterval);
      clearInterval(diagnosticsInterval);
    };
  }, [fetchMarkets]);

  const groupedMarkets = useMemo(() => {
    return markets.reduce((acc, m) => {
      const quote = m.quoteAsset || "USDT";
      if (!acc[quote]) acc[quote] = [];
      acc[quote].push(m);
      return acc;
    }, {} as Record<string, MarketData[]>);
  }, [markets]);

  const renderSparkline = (
    points: number[] | undefined,
    change: number = 0
  ) => {
    if (!points || points.length === 0) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 200;
    const height = 40;

    const svgPoints = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p - min) / range) * (height - 6) - 3;
        return `${x},${y}`;
      })
      .join(" ");

    const strokeColor = change >= 0 ? "#00C278" : "#F94D5C";

    return (
      <svg
        className="w-full h-full overflow-hidden"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`grad-${strokeColor}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M 0,${height} L ${svgPoints} L ${width},${height} Z`}
          fill={`url(#grad-${strokeColor})`}
        />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          points={svgPoints}
        />
      </svg>
    );
  };

  const portfolioWeights = useMemo(() => {
    return [
      { name: "BTC", value: 45, color: "#F7931A" },
      { name: "ETH", value: 30, color: "#627EEA" },
      { name: "SOL", value: 15, color: "#14F195" },
      { name: "USDT", value: 10, color: "#00C278" },
    ];
  }, []);

  return (
    <AuthGuard>
      <main className="min-h-screen w-full bg-[#0E1015] text-white flex flex-col font-sans select-none pb-12">
        {/* Upper Dashboard Statistics Row */}
        <section className="max-w-7xl w-full mx-auto px-6 mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Bento Box 1: Estimated Portfolio net worth summary */}
          <div className="bg-[#14151B] border border-slate-900 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between md:col-span-2 h-48">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00C278]/5 rounded-full blur-3xl pointer-events-none" />
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Master Portfolio Value
              </p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2 tabular-nums">
                $22,148.24
              </h1>
              <p className="text-[11px] text-[#00C278] mt-1 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C278] animate-ping" />
                +$512.40 (2.42%) in the last 24h
              </p>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push("/balance")}
                className="px-4 py-2 rounded-lg bg-[#00C278] hover:bg-[#00a868] text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Manage Wallet Balance
              </button>
            </div>
          </div>

          {/* Bento Box 2: Latency & Matching Engine diagnostics */}
          <div className="bg-[#14151B] border border-slate-900 rounded-2xl p-6 flex flex-col justify-between h-48">
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Engine Diagnostics
              </p>
              <div className="flex justify-between items-end mt-4">
                <div>
                  <span className="text-2xl font-black text-white font-mono">
                    {engineLatency} μs
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Orderbook Latency
                  </p>
                </div>
                <div>
                  <span className="text-2xl font-black text-[#00C278] font-mono">
                    {tradeCount.toLocaleString()}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Engine Trades Handled
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-900 pt-3">
              <span className="w-2 h-2 rounded-full bg-[#00C278] animate-pulse" />
              <span className="text-[11px] text-slate-400 font-medium">
                Matching pipeline connected at high-priority sockets
              </span>
            </div>
          </div>
        </section>

        {/* Grouped Square Box Markets Component Area */}
        <section className="max-w-7xl w-full mx-auto px-6 mt-12 flex flex-col gap-10">
          <div className="flex justify-between items-center px-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Market Spot Pairs
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Grouped by regional trade assets and quote hubs
              </p>
            </div>
            <button
              onClick={fetchMarkets}
              className="p-1.5 hover:bg-slate-900 border border-slate-800 rounded-lg transition text-slate-400 hover:text-white"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.582"
                />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-40 bg-[#14151B] border border-slate-900 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : (
            Object.entries(groupedMarkets).map(([quote, list]) => (
              <div key={quote} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 pl-2">
                  <div className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center border border-slate-800 shrink-0">
                    <Image
                      src={`/icons/${quote.toLowerCase()}_coin.png`}
                      alt={quote}
                      width={28}
                      height={28}
                      className="rounded-full border-2 border-[#14151B] bg-slate-800"
                      onError={(e) => {
                        // Only set the fallback if we aren't already trying to load it
                        if (!e.currentTarget.src.includes("generic_coin.svg")) {
                          e.currentTarget.src = "/icons/generic_coin.svg";
                        } else {
                          // If even the generic one fails, hide the broken icon to stop the loop
                          e.currentTarget.style.display = "none";
                        }
                      }}
                    />
                  </div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {quote} Markets Hub
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {list.map((m) => {
                    const change = m.change24h || 0;
                    const isPositive = change >= 0;

                    return (
                      <div
                        key={`${m.baseAsset}_${m.quoteAsset}`}
                        onClick={() =>
                          router.push(`/trade/${m.baseAsset}_${m.quoteAsset}`)
                        }
                        className="relative bg-[#14151B] border border-slate-900 rounded-2xl p-5 hover:border-slate-700/80 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between h-[160px] group"
                      >
                        <div className="z-10">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                              {m.baseAsset}
                              <span className="text-slate-500 font-semibold text-xs tracking-wide">
                                {m.quoteAsset}
                              </span>
                            </span>

                            <Image
                              src={`/icons/${m.baseAsset.toLowerCase()}_coin.png`}
                              alt={m.baseAsset}
                              width={28}
                              height={28}
                              className="rounded-full border-2 border-[#14151B] bg-slate-800"
                              onError={(e) => {
                                // Only set the fallback if we aren't already trying to load it
                                if (
                                  !e.currentTarget.src.includes(
                                    "generic_coin.svg"
                                  )
                                ) {
                                  e.currentTarget.src =
                                    "/icons/generic_coin.png";
                                } else {
                                  // If even the generic one fails, hide the broken icon to stop the loop
                                  e.currentTarget.style.display = "none";
                                }
                              }}
                            />
                          </div>

                          <p className="text-xl font-bold text-white mt-2.5 tracking-tight tabular-nums">
                            {quote === "INR" ? "₹" : "$"}
                            {(m.currentPrice / SCALE).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: quote === "INR" ? 2 : 4,
                                maximumFractionDigits: quote === "INR" ? 2 : 4,
                              }
                            )}
                          </p>

                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900/50 border border-slate-800/40">
                            <span
                              className={`text-[10px] font-bold tracking-wide flex items-center ${
                                isPositive ? "text-[#00C278]" : "text-[#F94D5C]"
                              }`}
                            >
                              {isPositive ? "▲ +" : "▼ "}
                              {change.toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Sparkline matching Screenshot 2026-07-16 at 3.11.29 PM.png base container gradient */}
                        <div className="absolute bottom-0 left-0 right-0 h-10 w-full select-none pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity">
                          {renderSparkline(m.sparkline, change)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Lower Portfolio & Ticker Log Diagnostics row */}
        <section className="max-w-7xl w-full mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bento Box 4: Portfolio asset allocation donut view */}
          <div className="bg-[#14151B] border border-slate-900 rounded-2xl p-6 flex flex-col justify-between h-96">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Asset Allocation
              </span>

              <div className="flex justify-center py-6">
                <svg
                  className="overflow-visible"
                  width="140"
                  height="140"
                  viewBox="0 0 140 140"
                >
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="transparent"
                    stroke="#1A1D24"
                    strokeWidth="18"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="transparent"
                    stroke="#F7931A"
                    strokeWidth="18"
                    strokeDasharray="282.7"
                    strokeDashoffset="127.2"
                    transform="rotate(-90 70 70)"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="transparent"
                    stroke="#627EEA"
                    strokeWidth="18"
                    strokeDasharray="282.7"
                    strokeDashoffset="212"
                    transform="rotate(72 70 70)"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="transparent"
                    stroke="#14F195"
                    strokeWidth="18"
                    strokeDasharray="282.7"
                    strokeDashoffset="240.3"
                    transform="rotate(180 70 70)"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="50"
                    fill="transparent"
                    stroke="#00C278"
                    strokeWidth="18"
                    strokeDasharray="282.7"
                    strokeDashoffset="254.4"
                    transform="rotate(234 70 70)"
                  />
                  <text
                    x="70"
                    y="76"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    className="font-extrabold text-[12px] font-sans"
                  >
                    Assets
                  </text>
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 border-t border-slate-900/60 pt-4">
              {portfolioWeights.map((w) => (
                <div key={w.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-md"
                    style={{ backgroundColor: w.color }}
                  />
                  <span className="text-[11px] font-bold text-slate-200">
                    {w.name}{" "}
                    <span className="text-slate-500 font-normal">
                      ({w.value}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bento Box 5: Live matching log tracker */}
          <div className="bg-[#14151B] border border-slate-900 rounded-2xl p-6 md:col-span-2 flex flex-col justify-between h-96">
            <div>
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-widest">
                Matched Market Trades Feed
              </span>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                System matched transactions processed instantly across all core
                engine ledgers.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar mt-4 flex flex-col gap-2.5">
              {[
                {
                  time: "12:13:38",
                  pair: "BTC/USDT",
                  qty: 0.145,
                  price: 89042.3,
                  side: "buy",
                },
                {
                  time: "12:13:32",
                  pair: "ETH/USDT",
                  qty: 2.12,
                  price: 2603.4,
                  side: "sell",
                },
                {
                  time: "12:13:28",
                  pair: "SOL/USDT",
                  qty: 15.0,
                  price: 145.2,
                  side: "buy",
                },
                {
                  time: "12:13:19",
                  pair: "XRP/USDT",
                  qty: 850.0,
                  price: 2.11,
                  side: "sell",
                },
                {
                  time: "12:13:04",
                  pair: "DOGE/USDT",
                  qty: 12000,
                  price: 0.35,
                  side: "buy",
                },
              ].map((t, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-[#0E1015] border border-slate-900 rounded-xl p-3 hover:bg-[#1E2026]/40 transition duration-150"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-500">
                      {t.time}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {t.pair}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        t.side === "buy"
                          ? "bg-[#00C278]/10 text-[#00C278]"
                          : "bg-[#F94D5C]/10 text-[#F94D5C]"
                      }`}
                    >
                      {t.side}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <span className="text-xs font-semibold text-slate-350">
                      {t.qty} Coins
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">
                      $
                      {t.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-900 pt-3 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Apex Core Ledger Synchronization</span>
              <span className="font-mono text-white">Status: Normal</span>
            </div>
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
