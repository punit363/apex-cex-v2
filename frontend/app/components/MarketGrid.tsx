"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CONFIG } from "../config";

const SCALE = CONFIG.SATOSHI_SCALE;

const Sparkline = ({
  points,
  change,
}: {
  points: number[];
  change: number;
}) => {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 120;
  const height = 30;
  const svgPoints = points
    .map(
      (p, i) =>
        `${(i / (points.length - 1)) * width},${
          height - ((p - min) / range) * height
        }`
    )
    .join(" ");
  const color = change >= 0 ? "#00C278" : "#F94D5C";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12 overflow-visible"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={svgPoints}
      />
    </svg>
  );
};

export const MarketGrid = ({ markets }: { markets: any[] }) => {
  const router = useRouter();

  const grouped = useMemo(() => {
    return markets.reduce((acc: Record<string, any[]>, m: any) => {
      const quote = m.quoteAsset || "Other";
      if (!acc[quote]) acc[quote] = [];
      acc[quote].push(m);
      return acc;
    }, {} as Record<string, any[]>);
  }, [markets]);

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(grouped).map(([quote, list]) => (
        <div key={quote} className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-2">
            {quote} Market Hub
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {list.map((m: any) => (
              <div
                key={`${m.baseAsset}_${m.quoteAsset}`}
                onClick={() =>
                  router.push(`/trade/${m.baseAsset}_${m.quoteAsset}`)
                }
                className="bg-[#14151B] border border-slate-800 rounded-xl p-4 hover:border-[#00C278]/50 transition-all cursor-pointer group flex flex-col justify-between h-36"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-white text-base">
                      {m.baseAsset}{" "}
                      <span className="text-slate-600 font-normal">
                        {m.quoteAsset}
                      </span>
                    </h3>
                  </div>
                  <p className="text-xl font-bold text-white mt-2 tabular-nums">
                    ₹{(m.currentPrice / SCALE).toFixed(2)}
                  </p>
                  <p
                    className={`text-xs font-medium flex items-center gap-1 ${
                      m.change24h >= 0 ? "text-[#00C278]" : "text-[#F94D5C]"
                    }`}
                  >
                    {m.change24h >= 0 ? "↗" : "↘"}{" "}
                    {Math.abs(m.change24h).toFixed(2)}%
                  </p>
                </div>
                <div className="mt-2 -mb-2">
                  <Sparkline points={m.sparkline || []} change={m.change24h} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
