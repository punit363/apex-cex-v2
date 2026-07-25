import { prisma } from "../client.js";
import { Transaction } from "../types/types.js";

export const TransactionRepo = {
  findById: async (tx_id: string) => {
    return prisma.transaction.findUnique({ where: { tx_id } });
  },

  create: async (data: Transaction) => {
    return prisma.transaction.create({ data });
  },
};
