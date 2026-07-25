import { prisma } from "../client.js";
import { Prisma } from "@prisma/client";
import { Candle } from "../types/types.js";

export const CandleRepo = {
  findById: async (candle_id: string) => {
    return prisma.candle.findUnique({ where: { candle_id } });
  },

  create: async (data: Candle) => {
    return prisma.candle.create({ data });
  },
};
