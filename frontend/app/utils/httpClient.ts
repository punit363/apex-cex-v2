import axios from "axios";
import { toast } from "react-hot-toast";
import { KLine, Ticker } from "./types";
import { CONFIG } from "../config";

const BASE_URL = CONFIG.API_URL;

function deleteCookie(name: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax;`;
  }
}
export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const accessToken = getCookie("access_token");
      if (accessToken) {
        config.headers["access_token"] = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    console.error("[AXIOS REQUEST ERROR] Interceptor failed:", error);
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    const result = response.data;
    if (result && result.status === 0) {
      toast.error(result.message || "An unexpected error occurred.");
      return Promise.reject(new Error(result.message));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    console.log(error);
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      console.warn(
        "[HTTP CLIENT] Access Token Expired. Initiating silent background rotation..."
      );

      return new Promise((resolve, reject) => {
        apiClient
          .post("/auth/refresh", {})
          .then(() => {
            console.log(
              "[HTTP CLIENT] Session rotated successfully. Retrying failed requests..."
            );
            processQueue(null);
            resolve(apiClient(originalRequest));
          })
          .catch((err) => {
            console.error(
              "[HTTP CLIENT] Silent rotation failed. Clearing session..."
            );
            processQueue(err);
            handleWipeAndLogout();
            toast.error("Session expired. Please log in again.");
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

function handleWipeAndLogout() {
  if (typeof window !== "undefined") {
    console.log("--------handleWipeAndLogout");
    localStorage.clear();
    deleteCookie("access_token");
    deleteCookie("refresh_token");
    window.dispatchEvent(new Event("auth_change"));
  }
}

function handleResponse(result: any) {
  if (!result) return null;
  return result.data !== undefined ? result.data : result;
}

export async function login(payload: {
  user_id?: string;
  email?: string;
  password?: string;
}) {
  const response = await apiClient.post("/auth/login", payload);
  const data = handleResponse(response.data);
  if (typeof window !== "undefined" && data) {
    localStorage.setItem(
      "user_profile",
      JSON.stringify({
        user_id: data.user_id,
        email: data.email,
        phone: data.phone,
        first_name: data.first_name,
        last_name: data.last_name,
        age: data.age,
      })
    );

    window.dispatchEvent(new Event("auth_change"));
    toast.success("Logged in successfully!");
  }
  return data;
}

export async function registerUser(payload: {
  firstname: string;
  lastname: string;
  age: number;
  email: string;
  phone: string;
  password?: string;
}) {
  const response = await apiClient.post("/user", payload);
  const data = handleResponse(response.data);
  toast.success("Account created successfully! Please log in.");
  return data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch (error) {
    console.warn("Backend token invalidation skipped:", error);
  } finally {
    if (typeof window !== "undefined") {
      console.log("--------logout");
      localStorage.clear();
      deleteCookie("access_token");
      deleteCookie("refresh_token");
      window.dispatchEvent(new Event("auth_change"));
      toast.success("Logged out successfully.");
    }
  }
}

function getCookie(name: string): string | null {
  if (typeof document !== "undefined") {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(";").shift() || "");
    }
  }
  return null;
}

export function getActiveUser() {
  if (typeof window !== "undefined") {
    const profile = localStorage.getItem("user_profile");

    if (profile) {
      try {
        return JSON.parse(profile);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function getTicker(market: string) {
  const response = await apiClient.get(`/ticker?market=${market}`);
  return handleResponse(response.data);
}

export async function getUserOrders(market: string, type: "open" | "history") {
  const response = await apiClient.get(`/order?market=${market}&type=${type}`);
  return handleResponse(response.data);
}

export async function getTickers(): Promise<Ticker[]> {
  const response = await apiClient.get("/tickers");
  return handleResponse(response.data);
}

export async function getTrades(market: string): Promise<any[]> {
  const response = await apiClient.get(`/trades?market=${market}`);
  return handleResponse(response.data);
}

export async function getDepth(market: string): Promise<any> {
  const response = await apiClient.get(`/depth?market=${market}`);
  return handleResponse(response.data);
}

export async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KLine[]> {
  const response = await apiClient.get(
    `/kline?market=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
  );
  const data: KLine[] = handleResponse(response.data);
  return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}

export async function createOrder(orderPayload: any): Promise<any> {
  const response = await apiClient.post("/order", orderPayload);
  const data = handleResponse(response.data);
  toast.success("Order placed successfully!");
  return data;
}

export async function getUserBalance(userId: string): Promise<any> {
  const response = await apiClient.get(`/balance?userId=${userId}`);
  return response.data;
}

export async function updateUserBalance(payload: {
  user_id: string;
  amount: number;
  asset: string;
  type: "deposit" | "withdraw" | string;
}): Promise<any> {
  const response = await apiClient.post("/balance", payload);
  return response.data;
}

export async function getAssets(): Promise<string[]> {
  const response = await apiClient.get("/asset");
  return response.data.data || response.data;
}

export async function cancelOrder(
  orderId: string,
  side: string,
  baseAsset: string,
  quoteAsset: string
) {
  const response = await apiClient.delete("/order", {
    data: {
      order_id: orderId,
      side: side,
      base_asset: baseAsset,
      quote_asset: quoteAsset,
    },
  });
  return response.data;
}
