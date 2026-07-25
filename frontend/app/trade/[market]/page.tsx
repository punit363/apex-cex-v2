"use client";

import { useState } from "react";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { KlineChart } from "@/app/components/KlineChart";
import { Depth } from "@/app/components/depth/Depth";
import { Trades } from "@/app/components/Trades";
import { useParams } from "next/navigation";
import { OrdersPanel } from "@/app/components/OrderPanel";
import { AuthGuard } from "@/app/components/AuthGuard";

export default function Page() {
  const { market } = useParams();
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");

  return (
    <AuthGuard>
      <div className="flex flex-row flex-1 bg-[#0B0E11] h-[calc(100vh-64px)] overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <MarketBar market={market as string} />

          <div className="flex flex-row flex-1 overflow-hidden border-y border-slate-800/50">
            {/* Left: Charting Area AND Orders Panel */}
            <div className="flex flex-col flex-1 border-r border-slate-800/50 overflow-hidden relative">
              {/* Top: The Chart */}
              <div className="flex-1 overflow-hidden relative">
                <KlineChart market={market as string} />
              </div>

              {/* Bottom: The Orders Panel */}
              <div className="shrink-0 w-full z-20 border-t border-slate-800/50">
                <OrdersPanel market={market as string} />
              </div>
            </div>

            {/* Middle: Tabbed Orderbook / Trades Panel */}
            <div className="flex flex-col w-[300px] overflow-hidden bg-[#14151B]">
              <div className="flex flex-row justify-between text-slate-500 px-3 pt-3 pb-2 border-b border-slate-800/50 font-sans text-xs shrink-0">
                <div className="flex gap-4">
                  <span
                    onClick={() => setActiveTab("book")}
                    className={`font-medium cursor-pointer transition-colors ${
                      activeTab === "book"
                        ? "text-white"
                        : "hover:text-slate-300"
                    }`}
                  >
                    Book
                  </span>
                  <span
                    onClick={() => setActiveTab("trades")}
                    className={`font-medium cursor-pointer transition-colors ${
                      activeTab === "trades"
                        ? "text-white"
                        : "hover:text-slate-300"
                    }`}
                  >
                    Trades
                  </span>
                </div>

                {activeTab === "book" && (
                  <div className="flex items-center gap-1 bg-[#1E2026] px-1.5 py-0.5 rounded text-[10px] text-white">
                    <span>0.01</span>
                  </div>
                )}
              </div>

              {/* DYNAMIC PANEL FIX APPLIED HERE */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Book Tab Container */}
                <div
                  className={`flex-1 flex-col overflow-hidden ${
                    activeTab === "book" ? "flex" : "hidden"
                  }`}
                >
                  <Depth market={market as string} />
                </div>

                {/* Trades Tab Container */}
                <div
                  className={`flex-1 flex-col overflow-hidden ${
                    activeTab === "trades" ? "flex" : "hidden"
                  }`}
                >
                  <Trades market={market as string} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[1px] flex-col bg-slate-800/50 shrink-0"></div>

        {/* Far Right: Order Entry / Swap UI */}
        <div className="bg-[#14151B] w-[300px] overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col p-2">
            <SwapUI market={market as string} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
