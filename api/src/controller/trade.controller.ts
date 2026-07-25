import { prisma } from "@exchange/db";
import { Request, Response } from "express";
import { generateAPIResponse, generateErrorResponse } from "../helper";
import { AppError } from "../helper/error";

const getTrades = async (req: Request, res: Response): Promise<any> => {
  try {
    const market = req.query.market as string;

    if (!market) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const [baseAsset, quoteAsset] = market.split("_");

    if (!baseAsset || !quoteAsset) {
      throw new AppError(`Invalid Market format. Use BASE_QUOTE`, 400);
    }

    const recentTrades = await prisma.trade.findMany({
      where: {
        base_asset: baseAsset,
        quote_asset: quoteAsset,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 50,
    });

    if (recentTrades.length <= 0) {
      throw new AppError(`Recent trades does not exist for this market`, 404);
    }

    const formattedTrades = recentTrades.map((trade) => ({
      tradeId: trade.trade_id,
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      timestamp: trade.created_at.getTime(),
      isBuyerMaker: trade.side.toLowerCase() === "sell",
    }));

    return res
      .status(200)
      .send(
        generateAPIResponse(
          formattedTrades,
          "Trade data fetched successfully",
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in trade/getTrades:", error);
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

export { getTrades };
