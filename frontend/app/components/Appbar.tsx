"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthModal } from "./AuthModal";
import { getActiveUser } from "../utils/httpClient";

export function Appbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

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

  const isTradeActive = pathname.startsWith("/trade");
  const isMarketsActive = pathname === "/" || pathname.startsWith("/markets");
  const isBalanceActive = pathname.startsWith("/balance");

  return (
    <header className="w-full bg-[#14151B] border-b border-slate-900 px-4 h-14 flex items-center justify-between z-40 shrink-0 select-none">
      
      <div className="flex items-center gap-8 h-full">
        <div 
          onClick={() => router.push("/")} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="p-1.5 bg-[#00C278]/10 border border-[#00C278]/20 rounded-lg group-hover:bg-[#00C278]/15 group-hover:border-[#00C278]/30 transition-all duration-300">
            <svg 
              className="w-4 h-4 text-[#00C278]" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2.5} 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              viewBox="0 0 24 24"
            >
              <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wider uppercase bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Apex Exchange
          </span>
        </div>

        <nav className="flex items-center gap-6 h-full text-xs font-semibold">
          <button
            onClick={() => router.push("/")}
            className={`transition-all duration-200 h-full flex items-center border-b-2 relative ${
              isMarketsActive 
                ? "text-white border-[#00C278]" 
                : "text-slate-400 hover:text-white border-transparent"
            }`}
          >
            Markets
            {isMarketsActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00C278] shadow-[0_0_12px_#00C278]" />
            )}
          </button>

          <button
            onClick={() => router.push("/balance")}
            className={`transition-all duration-200 h-full flex items-center border-b-2 relative ${
              isBalanceActive 
                ? "text-white border-[#00C278]" 
                : "text-slate-400 hover:text-white border-transparent"
            }`}
          >
            Balances
            {isBalanceActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00C278] shadow-[0_0_12px_#00C278]" />
            )}
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-5">
        
        {currentUser && (
          <div className="flex items-center gap-2">
            <button className="px-3.5 py-1.5 bg-[#00C278]/10 hover:bg-[#00C278]/15 border border-[#00C278]/20 hover:border-[#00C278]/40 text-[#00C278] text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all duration-200">
              Deposit
            </button>
            <button className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all duration-200">
              Withdraw
            </button>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-[#0E1015] border border-slate-900 rounded-lg text-[10px] text-slate-400 font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C278] animate-pulse" />
          Engine: Connected
        </div>

        <div className="pl-4 border-l border-slate-800 h-6 flex items-center">
          <AuthModal />
        </div>
        
      </div>
    </header>
  );
}