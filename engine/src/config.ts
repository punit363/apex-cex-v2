import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// 2. Define a strict configuration schema
const _config = {
    SCALE: parseInt(process.env.SATOSHI_SCALE || "100000000", 10),
};

// 3. Fail-Fast: Validate critical configurations on startup
// if (!_config.DATABASE_URL) {
//   console.error("❌ CRITICAL BOOT FAILURE: DATABASE_URL is missing in .env file.");
//   process.exit(1);
// }

// 4. Export as read-only to prevent runtime modifications
export const CONFIG = Object.freeze(_config);
