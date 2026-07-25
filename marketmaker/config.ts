import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// 1. Reconstruct __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Safely resolve relative path to the monorepo root .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// 2. Define a strict configuration schema
const _config = {
  SCALE: parseInt(process.env.SATOSHI_SCALE || "100000000", 10),
  CLIENT_URL :process.env.CLIENT_URL || "http://localhost:1000",
  WS_PORT: process.env.WS_PORT || "7001",
  MM_QUOTE_ASSET: process.env.MM_QUOTE_ASSET || "USDT",
  MM_BASE_ASSET: process.env.MM_BASE_ASSET || "BTC",
};

// 3. Fail-Fast: Validate critical configurations on startup
// if (!_config.DATABASE_URL) {
//   console.error("❌ CRITICAL BOOT FAILURE: DATABASE_URL is missing in .env file.");
//   process.exit(1);
// }

// 4. Export as read-only to prevent runtime modifications
export const CONFIG = Object.freeze(_config);
