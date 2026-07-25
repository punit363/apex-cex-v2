import { prisma } from "../client.js";
import { Prisma } from "@prisma/client";
import { Order } from "../types/types.js";

export const OrderRepo = {
  findById: async (order_id: string) => {
    return prisma.order.findUnique({ where: { order_id } });
  },

  updateFilledAndStatus: async (data: {
    order_id: string;
    filled: number;
    status: "open" | "partial" | "cancelled" | "filled";
  }) => {
    return prisma.order.update({
      data: { filled_quantity: data.filled, status: data.status },
      where: {
        order_id: data.order_id,
      },
    });
  },

  cancelOrder: async (data: {
    order_id: string;
    status: "cancelled";
  }) => {
    return prisma.order.update({
      data: { status: data.status },
      where: {
        order_id: data.order_id,
      },
    });
  },

  create: async (data: Order) => {
    return prisma.order.create({ data });
  },

  getUserOrders: async (
    userId: string,
    market: string,
    type: "open" | "history"
  ) => {
    const [base_asset, quote_asset] = market.split("_");

    const targetStatuses =
      type === "open" ? ["open", "partial"] : ["filled", "cancelled"];

    const orders = await prisma.order.findMany({
      where: {
        user_id: userId,
        base_asset: base_asset,
        quote_asset: quote_asset,
        status: {
          in: targetStatuses,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      take: 100,
    });

    return orders;
  },
};
