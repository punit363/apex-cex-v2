import { TickerRepo } from "@exchange/db";
import { Request, Response } from "express";
import RedisHandler from "../redis";
import { generateAPIResponse, generateErrorResponse } from "../helper";
import { EngineResponse } from "../types/types";
import { AppError } from "../helper/error";

const fetchTickerData = async (req: Request, res: Response): Promise<any> => {
  try {
    const market = req.query.market as string;

    if (!market) {
      throw new AppError(`Missing required request parameter`, 400);
    }

    const ticker = await TickerRepo.get24hTicker(market);

    if (!ticker) {
      throw new AppError(`Tciker data not found for this market`, 404);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          ticker,
          "Ticker data fetched successfully",
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in Markets/fetchTickerData:", error);
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

const fetchDepth = async (req: Request, res: Response): Promise<any> => {
  try {
    const market = (req.query.symbol || req.query.market) as string;

    if (!market) {
      throw new AppError(`Missing required request parameter`, 400);
    }

    const redisHandler = await RedisHandler.createInstance();

    const market_depth = await redisHandler.get(`DEPTH:${market}`);
    const depth = JSON.parse(market_depth || "{}");

    if (market_depth) {
      return res
        .status(200)
        .send(
          generateAPIResponse(
            depth,
            "Market depth fetched successfully",
            "SUCCESS",
            1
          )
        );
    } else {
      throw new AppError(`Market Depth not found for this market`, 404);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in Markets/fetchDepth:", error);
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

const fetchAllMarkets = async (req: Request, res: Response): Promise<any> => {
  try {
    const user_id = req.user_id;

    if (!user_id) {
      throw new AppError(`Missing required request parameter`, 400);
    }

    const market = {
      action: "FETCH_ALL_MARKETS",
      user_id,
    };

    const redis = await RedisHandler.createInstance();
    const engine_response = (await redis.sendAndAwait({
      type: "MARKET",
      market,
    })) as EngineResponse;

    if (engine_response.eng_status_code === 0) {
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
    console.error("Error in Market/FetchAllMarkets:", error);
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

export { fetchTickerData, fetchDepth, fetchAllMarkets };
