import { Request, Response } from "express";
import RedisHandler from "../redis";
import { generateOrderId } from "../utils";
import { generateAPIResponse, generateErrorResponse } from "../helper";
import { EngineResponse } from "../types/types";
import { OrderRepo } from "@exchange/db";
import { AppError } from "../helper/error";
import { riskCheckClient } from "../grpc/client";

const placeOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { price, quantity, side, type, baseAsset, quoteAsset } = req.body;

    const user_id = req.user_id as string;
    if (!user_id || !side || !type || !baseAsset || !quoteAsset) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const order_id = generateOrderId();

    const payload = {
      user_id,
      order_id,
      price,
      quantity,
      side: side.toUpperCase(),
      type,
      base_asset: baseAsset,
      quote_asset: quoteAsset,
    };

    riskCheckClient.ValidateAndProcessOrder(
      payload,
      (err: any, response: any) => {
        if (err) {
          console.error("gRPC Request Failed:", err);
          return res.status(500).json({ message: "Risk check failed" });
        }
        return res.status(200).json(response);
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in order/placeOrder:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

const getOrders = async (req: Request, res: Response): Promise<any> => {
  try {
    const user_id = req.user_id as string;
    const market = req.query.market as string;
    const type = req.query.type as "open" | "history";

    if (!user_id || !market || !type) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const order_history = await OrderRepo.getUserOrders(user_id, market, type);

    if (order_history.length <= 0) {
      throw new AppError(`Order not found`, 404);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          order_history,
          "Orders fetched successfully",
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in order/getOrders:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

const cancelOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { order_id, side, base_asset, quote_asset } = req.body;
    const user_id = req.user_id as string;

    if (!order_id) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const redis = await RedisHandler.createInstance();

    const market = `${base_asset}_${quote_asset}`;
    const order = {
      user_id,
      action: "CANCEL_ORDER",
      order_data: {
        order_id,
        side,
        base_asset,
        quote_asset,
      },
    };

    await redis.addOrderRequestToEngineStream(market, order);

    return res
      .status(200)
      .send(
        generateAPIResponse(
          null,
          "Order cancellation request successfully placed",
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in order/cancelOrder:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

export { placeOrder, getOrders, cancelOrder };
