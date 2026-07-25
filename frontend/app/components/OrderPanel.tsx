"use client";

import { useEffect, useState } from "react";
import { getUserOrders, cancelOrder } from "../utils/httpClient";
import { wsClient } from "../utils/wsClient"; 
import { toast } from "react-hot-toast";
import { CONFIG } from "../config";

const SCALE = CONFIG.SATOSHI_SCALE;

export function OrdersPanel({ market }: { market: string }) {
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);


  const [baseAsset, quoteAsset] = market.split("_");

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getUserOrders(market, activeTab);
      const parsed = Array.isArray(data)
        ? data
        : (data?.asks || []).concat(data?.bids || []);
      setOrders(parsed);
    } catch (err) {
      toast.error("Failed to load orders.");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchOrders();

    const handleOrderUpdate = (data: any) => {

      if (!isMounted) return;


      if (data.market !== market) return;

      const newOrder = data.order;
      if (!newOrder) return;

      if (activeTab === "open") {
        setOrders((prev) => {
          const orderId = newOrder.orderId || newOrder.order_id;
          const exists = prev.find(
            (o) => (o.orderId || o.order_id) === orderId
          );

          if (exists) {
            return prev.map((o) =>
              (o.orderId || o.order_id) === orderId ? newOrder : o
            );
          }
          return [newOrder, ...prev];
        });
      }
    };

    wsClient.subscribe(market, "ORDER", handleOrderUpdate);

    return () => {
      isMounted = false;
      wsClient.unsubscribe(market, "ORDER", handleOrderUpdate);
    };
  }, [market, activeTab]);

  const handleCancel = async (orderId: string, side: string) => {
    try {
      const response = await cancelOrder(orderId, side, baseAsset, quoteAsset);
      if (response && response.status === "SUCCESS") {
        setOrders((prevOrders) =>
          prevOrders.filter((o) => (o.orderId || o.order_id) !== orderId)
        );
        toast.success(response?.message || "Order cancelled successfully");
      } else {
        toast.error(response?.message || "Failed to cancel order");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Connection failed");
    }
  };

  return (
    <div
      className={`flex flex-col w-full bg-[#14151B] transition-all duration-300 border-t border-slate-900 ${
        isExpanded ? "h-[280px]" : "h-[40px]"
      }`}
    >
      <div className="flex flex-row items-center justify-between px-4 h-[40px] shrink-0 border-b border-slate-800/50">
        <div className="flex gap-6 h-full">
          <button
            onClick={() => setActiveTab("open")}
            className={`text-xs font-bold h-full border-b-2 ${
              activeTab === "open"
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-500"
            }`}
          >
            Open Orders
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`text-xs font-bold h-full border-b-2 ${
              activeTab === "history"
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-500"
            }`}
          >
            Order History
          </button>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-500 hover:text-white"
        >
          {isExpanded ? "▼" : "▲"}
        </button>
      </div>

      <div
        className={`flex-1 overflow-y-auto ${
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`grid ${
            activeTab === "open" ? "grid-cols-8" : "grid-cols-7"
          } gap-4 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-800/30 min-h-[36px] items-center`}
        >
          <div>Time</div>
          <div>Pair</div>
          <div>Type / Side</div>
          <div className="text-right">Price</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Filled</div>
          <div className="text-right">Status</div>
          {activeTab === "open" && <div className="text-right">Action</div>}
        </div>

        {orders.map((o, i) => (
          <div
            key={o.orderId || o.order_id || i}
            className={`grid ${
              activeTab === "open" ? "grid-cols-8" : "grid-cols-7"
            } gap-4 px-4 py-3 text-xs font-bold border-b border-slate-800/20 items-center group`}
          >
            <div className="text-slate-500">
              {o.created_at
                ? new Date(o.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "-"}
            </div>
            <div className="font-bold text-slate-300">
              {market.replace("_", "/")}
            </div>
            <div className="flex gap-1.5 font-bold">
              <span className="text-slate-500 capitalize">
                {o.type || "limit"}
              </span>
              <span
                className={
                  o.side?.toLowerCase() === "buy"
                    ? "text-[#00C278]"
                    : "text-[#F94D5C]"
                }
              >
                {o.side?.toUpperCase()}
              </span>
            </div>
            <div className="text-right tabular-nums text-slate-200">
              {o.type === "market" && o.side === "sell"
                ? "-"
                : (Number(o.price) / SCALE).toFixed(2)}
            </div>
            <div className="text-right tabular-nums text-slate-200">
              {o.type === "market" && o.side === "buy"
                ? "-"
                : (Number(o.quantity) / SCALE).toFixed(4)}
            </div>
            <div className="text-right tabular-nums text-slate-400">
              {(Number(o.filled_quantity ?? o.filled ?? 0) / SCALE).toFixed(4)}
            </div>
            <div className="text-right capitalize text-slate-300">
              {o.status}
            </div>

            {activeTab === "open" && (
              <div className="text-right">
                <button
                  onClick={() => handleCancel(o.orderId || o.order_id, o.side)}
                  className="text-[#F94D5C] hover:underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
