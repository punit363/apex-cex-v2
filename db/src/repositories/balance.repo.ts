import { prisma } from "../client.js";
import { Prisma } from "@prisma/client";
import { Balance } from "../types/types.js";

export const BalanceLedgerRepo = {
  findById: async (id: string) => {
    return prisma.balanceLedger.findUnique({ where: { id } });
  },

  create: async (data: Balance) => {
    return prisma.balanceLedger.create({ data });
  },
};
