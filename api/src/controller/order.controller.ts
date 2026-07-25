import { Request, Response } from "express";
import RedisHandler from "../redis";
import { generateOrderId } from "../utils";
import { generateAPIResponse, generateErrorResponse } from "../helper";
import { EngineResponse } from "../types/types";
import { OrderRepo } from "@exchange/db";
import { AppError } from "../helper/error";

const placeOrder = async (req: Request, res: Response): Promise<any> => {
  try {
    const { price, quantity, side, type, baseAsset, quoteAsset } = req.body;

    const user_id = req.user_id as string;
    if (!user_id || !side || !type || !baseAsset || !quoteAsset) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const order_id = generateOrderId();
    const redis = await RedisHandler.createInstance();
    type OrderResponse = {
      order_id: string;
      fills: {
        price: number;
        quantity: number;
        tradeId: string;
        userId: string;
        otherUserId: string;
      }[];
      unsold_market_order_quanity: number;
      unused_market_order_amount: number;
    };

    const engine_response = (await redis.sendAndAwait({
      type: "ORDER",
      order: {
        action: "PLACE_ORDER",
        user_id,
        order_data: {
          order_id,
          price,
          quantity,
          side,
          type,
          baseAsset,
          quoteAsset,
        },
      },
    })) as EngineResponse;

    if (!engine_response.data) {
      throw new AppError(engine_response.message, 404);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          engine_response.data,
          engine_response.message,
          engine_response.status,
          1
        )
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

    const engine_response = (await redis.sendAndAwait({
      type: "ORDER",
      order: {
        user_id,
        action: "CANCEL_ORDER",
        order_data: {
          order_id,
          side,
          baseAsset: base_asset,
          quoteAsset: quote_asset,
        },
      },
    })) as EngineResponse;

    if (!engine_response.data) {
      throw new AppError(engine_response.message, 404);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          engine_response.data,
          engine_response.message,
          engine_response.status,
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
