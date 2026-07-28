import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// 2. Define a strict configuration schema
const _config = {
  NODE_ENV: "production",
  SCALE: parseInt(process.env.SATOSHI_SCALE || "100000000", 10),
  CORS_ACCEPTED_ENDPOINT: process.env.CORS_ACCEPTED_ENDPOINT,
  API_PORT: process.env.API_PORT,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN,
  ACCESS_COOKIE_AGE: process.env.ACCESS_COOKIE_AGE,
  REFRESH_COOKIE_AGE: process.env.REFRESH_COOKIE_AGE,
  SUPPORTED_MARKETS: JSON.parse(process.env.SUPPORTED_MARKETS || "[]"),
};

// 3. Fail-Fast: Validate critical configurations on startup
// if (!_config.DATABASE_URL) {
//   console.error("❌ CRITICAL BOOT FAILURE: DATABASE_URL is missing in .env file.");
//   process.exit(1);
// }

// 4. Export as read-only to prevent runtime modifications
export const CONFIG = Object.freeze(_config);
