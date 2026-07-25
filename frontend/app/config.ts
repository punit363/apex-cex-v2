interface FrontendConfig {
  API_URL: string;
  WS_URL: string;
  SATOSHI_SCALE: number;
  NEXT_PUBLIC_ACCESS_COOKIE_AGE: number;
  NEXT_PUBLIC_REFRESH_COOKIE_AGE: number;
}

const _config: FrontendConfig = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:7001",
  SATOSHI_SCALE: parseInt(
    process.env.NEXT_PUBLIC_SATOSHI_SCALE || "100000000",
    10
  ),
  NEXT_PUBLIC_ACCESS_COOKIE_AGE: parseInt(
    process.env.NEXT_PUBLIC_ACCESS_COOKIE_AGE || "900000",
    10
  ),
  NEXT_PUBLIC_REFRESH_COOKIE_AGE: parseInt(
    process.env.NEXT_PUBLIC_REFRESH_COOKIE_AGE || "604800000",
    10
  ),
};

if (typeof window === "undefined") {
  const REQUIRED_KEYS: (keyof FrontendConfig)[] = ["API_URL", "WS_URL"];

  for (const key of REQUIRED_KEYS) {
    const value = _config[key];
    if (value === undefined || value === null || value === "") {
      console.error(
        `❌ FE CRITICAL BOOT FAILURE: Next.js missing environment key: NEXT_PUBLIC_${key}`
      );
      throw new Error(
        `Missing required environment variable: NEXT_PUBLIC_${key}`
      );
    }
  }
}

export const CONFIG = Object.freeze(_config);
