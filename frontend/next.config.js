const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_SATOSHI_SCALE: process.env.NEXT_PUBLIC_SATOSHI_SCALE,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV || "development",
    NEXT_PUBLIC_ACCESS_COOKIE_AGE: process.env.NEXT_PUBLIC_ACCESS_COOKIE_AGE,
    NEXT_PUBLIC_REFRESH_COOKIE_AGE: process.env.NEXT_PUBLIC_REFRESH_COOKIE_AGE,
  },
};

module.exports = nextConfig;
