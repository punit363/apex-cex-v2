import express from "express";
import {
  getOrders,
  placeOrder,
  cancelOrder,
} from "../controller/order.controller";
import {
  fetchAllAssets,
  fetchUserBalance,
  registerUser,
  updateBalance,
  fetchUserDetails,
} from "../controller/user.controller";
import { fetchKline } from "../controller/kline.controller";
import {
  fetchAllMarkets,
  fetchDepth,
  fetchTickerData,
} from "../controller/market.controller";
import { getTrades } from "../controller/trade.controller";
import {
  loginUser,
  logoutUser,
  refreshTokens,
} from "../controller/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/auth/login", loginUser);
router.post("/auth/logout", authMiddleware, logoutUser);
router.post("/auth/refresh", refreshTokens);

router.post("/order", authMiddleware, placeOrder);
router.get("/order", authMiddleware, getOrders);
router.delete("/order", authMiddleware, cancelOrder);

router.get("/ticker", authMiddleware, fetchTickerData);
router.get("/depth", authMiddleware, fetchDepth);
router.get("/kline", authMiddleware, fetchKline);
router.get("/market/all", authMiddleware, fetchAllMarkets);

router.post("/user", registerUser);
router.get("/user", fetchUserDetails);
router.post("/balance", authMiddleware, updateBalance);
router.get("/balance", authMiddleware, fetchUserBalance);
router.get("/asset", authMiddleware, fetchAllAssets);

router.get("/trades", authMiddleware, getTrades);

export default router;
