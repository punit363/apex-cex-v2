import axios from "axios";
import type { AxiosInstance } from "axios";
import { CONFIG } from "./config.js";

// Normalize BASE_URL across property naming variants (CLIENT_URL, API_URL, or BASE_URL)
const RAW_URL = (CONFIG as any).CLIENT_URL || (CONFIG as any).API_URL || (CONFIG as any).BASE_URL || "http://localhost:8000/api/v1";

// Ensure URL cleanly includes /api/v1 prefix without trailing slashes
const BASE_API_URL = RAW_URL.replace(/\/+$/, "").includes("/api/v1")
  ? RAW_URL.replace(/\/+$/, "")
  : `${RAW_URL.replace(/\/+$/, "")}/api/v1`;

const BASE = (CONFIG as any).MM_BASE_ASSET || "BTC";
const QUOTE = (CONFIG as any).MM_QUOTE_ASSET || "INR";
const SCALE = (CONFIG as any).SCALE || (CONFIG as any).SATOSHI_SCALE || 100_000_000;

// User credentials (ensure this user is seeded in your database)
const USER_CONFIG = {
  email: "punit@gmail.com",
  password: "12345678",
};

// Global session-authenticated Axios client
let apiClient: AxiosInstance;

async function authenticate(): Promise<void> {
  try {
    const loginUrl = `${BASE_API_URL}/auth/login`;
    console.log(`🔑 Authenticating Market Maker against target: ${loginUrl}`);

    const loginRes = await axios.post(
      loginUrl,
      {
        email: USER_CONFIG.email,
        password: USER_CONFIG.password,
      },
      {
        withCredentials: true,
      }
    );

    // Extract raw Set-Cookie response array sent by Express
    const setCookieHeaders = loginRes.headers["set-cookie"];

    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      throw new Error(
        "No Set-Cookie headers returned by server. Verify user credentials and server cookie configuration."
      );
    }

    // Format raw cookies into outgoing HTTP Cookie header ("access_token=...; refresh_token=...")
    const cookieString = setCookieHeaders
      .map((cookie: string) => cookie.split(";")[0])
      .join("; ");

    // Instantiate session-bound client
    apiClient = axios.create({
      baseURL: BASE_API_URL,
      headers: {
        Cookie: cookieString,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Authenticated successfully! Cookie session attached.");
  } catch (err: any) {
    console.error("❌ Market Maker Auth Failed:");
    if (err.response) {
      console.error(`  Status: ${err.response.status}`);
      console.error(`  Target URL: ${err.config?.url}`);
      console.error(`  Server Response:`, err.response.data);
    } else {
      console.error(`  Error: ${err.message}`);
    }
    process.exit(1);
  }
}

async function runMarketMaker() {
  await authenticate();

  console.log("🚀 Starting Market Maker Bot Execution Loop...");

  setInterval(async () => {
    try {
      const side = Math.random() > 0.5 ? "buy" : "sell";
      const price = (10000 + Math.floor(Math.random() * 1000)) * SCALE;
      const quantity = Math.floor(Math.random() * 100) * SCALE;

      console.log(
        `[BOT] Placing ${side.toUpperCase()} limit order: ${(quantity / SCALE).toFixed(2)} ${BASE} @ ₹${(price / SCALE).toLocaleString()}`
      );

      // Submit order using session-bound cookie client
      await apiClient.post("/order", {
        price,
        quantity,
        side,
        type: "limit",
        baseAsset: BASE,
        quoteAsset: QUOTE,
      });
    } catch (err: any) {
      console.error(
        "[BOT ERROR] Order placement rejected:",
        err.response?.data?.message || err.message
      );

      // Automatic re-authentication handler for 401 Unauthorized
      if (err.response?.status === 401) {
        console.warn("🔄 Cookie session expired. Re-authenticating market maker...");
        await authenticate();
      }
    }
  }, 1000);
}

runMarketMaker().catch(console.error);