import { CONFIG } from "../config";

type Callback = (data: any) => void;

class WSManager {
  private static instance: WSManager;
  private ws: WebSocket | null = null;
  private url = CONFIG.WS_URL;

  private callbacks: Map<string, Callback[]> = new Map();
  private bufferedMessages: any[] = [];

  private isConnecting = false;
  private initialized = false;

  private constructor() {}

  public static getInstance(): WSManager {
    if (!WSManager.instance) {
      WSManager.instance = new WSManager();
    }
    return WSManager.instance;
  }

  public connect() {
    if (typeof window === "undefined") return;
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;

    this.url = CONFIG.WS_URL;

    console.log(`⏳ Attempting to connect to WS at ${this.url}...`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.isConnecting = false;
      this.initialized = true;
      console.log("🟢 Connected to Trading WS");

      this.bufferedMessages.forEach((msg) => {
        this.ws?.send(JSON.stringify(msg));
      });
      this.bufferedMessages = [];
    };

    this.ws.onerror = (error) => {
      console.error("🔴 WebSocket Error: ", error);
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const market = parsed.market;
        console.log("++++++++++++++++++++++++Received WS message:", parsed);
        console.log("++++++++++++++++++++++++Received WS message:", market);
        if (!market) {
          console.warn("WS message missing 'market' field.", parsed);
          return;
        }

        console.log("🟢 WS RECEIVED:", parsed);

        if (parsed.order !== undefined) {
          const channel = `ORDER@${market}`;
          const cbs = this.callbacks.get(channel) || [];
          cbs.forEach((cb) => cb(parsed));
        } else if (parsed.trade !== undefined || parsed.fills !== undefined) {
          const channel = `TRADE@${market}`;
          const cbs = this.callbacks.get(channel) || [];
          cbs.forEach((cb) => cb(parsed));
        } else if (
          parsed.book !== undefined ||
          parsed.book_with_quantity !== undefined
        ) {
          const channel = `BOOK@${market}`;
          const cbs = this.callbacks.get(channel) || [];
          cbs.forEach((cb) => cb(parsed));
        } else if (parsed.ticker !== undefined) {
          const channel = `TICKER@${market}`;
          const cbs = this.callbacks.get(channel) || [];
          cbs.forEach((cb) => cb(parsed));
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    this.ws.onclose = (event) => {
      this.isConnecting = false;
      this.initialized = false;
      this.ws = null;
      console.log(
        `🔴 WS Disconnected (Code: ${event.code}). Reconnecting in 3s...`
      );
      setTimeout(() => this.connect(), 3000);
    };
  }

  private sendSubscribe(
    market: string,
    type: "TRADE" | "BOOK" | "TICKER" | "ORDER"
  ) {
    const message = { action: "SUBSCRIBE", type, market };

    if (!this.initialized || this.ws?.readyState !== WebSocket.OPEN) {
      this.bufferedMessages.push(message);
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  private sendUnsubscribe(
    market: string,
    type: "TRADE" | "BOOK" | "TICKER" | "ORDER"
  ) {
    const message = { action: "UNSUBSCRIBE", type, market };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public subscribe(
    market: string,
    type: "TRADE" | "BOOK" | "TICKER" | "ORDER",
    callback: Callback
  ) {
    const channel = `${type}@${market}`;
    const cbs = this.callbacks.get(channel) || [];

    this.callbacks.set(channel, [...cbs, callback]);

    if (cbs.length === 0) {
      this.sendSubscribe(market, type);
    }
  }

  public unsubscribe(
    market: string,
    type: "TRADE" | "BOOK" | "TICKER" | "ORDER",
    callback: Callback
  ) {
    const channel = `${type}@${market}`;
    const cbs = this.callbacks.get(channel) || [];

    const filtered = cbs.filter((cb) => cb !== callback);
    this.callbacks.set(channel, filtered);

    if (filtered.length === 0) {
      this.sendUnsubscribe(market, type);
    }
  }
}

export const wsClient = WSManager.getInstance();
