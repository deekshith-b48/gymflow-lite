import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { orderStatusValidator } from "./schema";
import { requireStaff } from "./staff";

const DAY_MS = 86_400_000;

/**
 * Checkout. No payment gateway is connected yet, so a card checkout settles in
 * the sandbox and a desk checkout stays pending until someone collects it.
 * Swapping in a real gateway means calling it here and keeping the same shape.
 */
export const checkout = mutation({
  args: {
    itemId: v.id("catalogItems"),
    method: v.union(v.literal("sandbox_card"), v.literal("desk")),
    memberId: v.optional(v.id("members")),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("That catalog item no longer exists.");
    if (item.status !== "published") {
      throw new Error("Publish the item before selling it.");
    }

    const now = Date.now();
    const settled = args.method === "sandbox_card";

    const orderId = await ctx.db.insert("orders", {
      itemId: args.itemId,
      itemName: item.name,
      userId,
      memberId: args.memberId,
      amountCents: item.priceCents,
      status: settled ? "paid" : "pending",
      method: args.method,
      provider: settled ? "sandbox" : "desk",
      reference: `GN-${now.toString(36).toUpperCase().slice(-6)}`,
      createdAt: now,
      paidAt: settled ? now : undefined,
    });

    return {
      orderId,
      status: settled ? ("paid" as const) : ("pending" as const),
      amountCents: item.priceCents,
      itemName: item.name,
    };
  },
});

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);

    const all = await ctx.db.query("orders").order("desc").take(200);
    const status = args.status && args.status !== "all" ? args.status : null;
    const items = status
      ? all.filter((order) => order.status === status)
      : all;

    const now = Date.now();
    const monthStart = now - 30 * DAY_MS;
    const paid = all.filter((order) => order.status === "paid");

    return {
      items,
      mine: all.filter((order) => order.userId === userId),
      stats: {
        revenueCents: paid.reduce((sum, order) => sum + order.amountCents, 0),
        revenue30dCents: paid
          .filter((order) => order.createdAt >= monthStart)
          .reduce((sum, order) => sum + order.amountCents, 0),
        paidCount: paid.length,
        pendingCents: all
          .filter((order) => order.status === "pending")
          .reduce((sum, order) => sum + order.amountCents, 0),
      },
    };
  },
});

export const setStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: orderStatusValidator,
  },
  handler: async (ctx, { orderId, status }) => {
    await requireStaff(ctx);

    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("That order no longer exists.");

    await ctx.db.patch(orderId, {
      status,
      paidAt: status === "paid" ? Date.now() : order.paidAt,
    });
  },
});
