import { prisma } from "../client.js";
import { Prisma } from '@prisma/client'
import { Trade } from "../types/types.js";

export const TradeRepo = {
  findById: async (trade_id: string) => {
    return prisma.trade.findUnique({ where: { trade_id } });
  },

  create: async (data: Trade) => {
    return prisma.trade.create({ data });
  },
};
