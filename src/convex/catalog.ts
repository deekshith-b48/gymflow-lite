import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { cadenceValidator, catalogStatusValidator } from "./schema";
import { withSpots } from "./sessions";
import { requireStaff } from "./staff";

export function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/** Searchable list of everything the workspace sells. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const items = await ctx.db.query("catalogItems").collect();
    const term = args.search?.trim().toLowerCase() ?? "";
    const category =
      args.category && args.category !== "all" ? args.category : null;
    const status = args.status && args.status !== "all" ? args.status : null;

    const filtered = items
      .filter((item) => {
        if (category && item.category !== category) return false;
        if (status && item.status !== status) return false;
        if (!term) return true;
        return [item.name, item.tagline, item.category, item.features.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const published = items.filter((item) => item.status === "published");

    return {
      items: filtered,
      categories: Array.from(new Set(items.map((item) => item.category))).sort(),
      stats: {
        total: items.length,
        published: published.length,
        drafts: items.filter((item) => item.status === "draft").length,
        categories: new Set(items.map((item) => item.category)).size,
        averagePriceCents: published.length
          ? Math.round(
              published.reduce((sum, item) => sum + item.priceCents, 0) /
                published.length,
            )
          : 0,
      },
    };
  },
});

/** One catalog item, its bookable times and what it has sold. */
export const get = query({
  args: { itemId: v.id("catalogItems") },
  handler: async (ctx, { itemId }) => {
    const userId = await requireStaff(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) return null;

    const now = Date.now();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();

    const upcoming = sessions
      .filter((session) => session.startsAt >= now - 3_600_000)
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 6);

    const recentOrders = await ctx.db.query("orders").order("desc").take(200);
    const sales = recentOrders.filter((order) => order.itemId === itemId);

    return {
      item,
      sessions: await Promise.all(
        upcoming.map((session) => withSpots(ctx, session, userId)),
      ),
      sales: {
        orders: sales.length,
        paidCents: sales
          .filter((order) => order.status === "paid")
          .reduce((sum, order) => sum + order.amountCents, 0),
      },
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    tagline: v.string(),
    description: v.string(),
    category: v.string(),
    priceCents: v.number(),
    cadence: cadenceValidator,
    capacity: v.number(),
    features: v.array(v.string()),
    status: catalogStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("A name is required.");
    if (args.priceCents < 0) throw new Error("Price cannot be negative.");

    return await ctx.db.insert("catalogItems", {
      name,
      slug: slugify(name),
      tagline: args.tagline.trim(),
      description: args.description.trim(),
      category: args.category.trim() || "General",
      priceCents: Math.round(args.priceCents),
      cadence: args.cadence,
      capacity: Math.max(1, Math.round(args.capacity)),
      features: args.features.map((feature) => feature.trim()).filter(Boolean),
      status: args.status,
      createdBy: userId,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    itemId: v.id("catalogItems"),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    cadence: v.optional(cadenceValidator),
    capacity: v.optional(v.number()),
    features: v.optional(v.array(v.string())),
    status: v.optional(catalogStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("That item no longer exists.");

    const patch: Partial<Doc<"catalogItems">> = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("A name is required.");
      patch.name = name;
      patch.slug = slugify(name);
    }
    if (args.tagline !== undefined) patch.tagline = args.tagline.trim();
    if (args.description !== undefined) {
      patch.description = args.description.trim();
    }
    if (args.category !== undefined) {
      patch.category = args.category.trim() || "General";
    }
    if (args.priceCents !== undefined) {
      if (args.priceCents < 0) throw new Error("Price cannot be negative.");
      patch.priceCents = Math.round(args.priceCents);
    }
    if (args.cadence !== undefined) patch.cadence = args.cadence;
    if (args.capacity !== undefined) {
      patch.capacity = Math.max(1, Math.round(args.capacity));
    }
    if (args.features !== undefined) {
      patch.features = args.features
        .map((feature) => feature.trim())
        .filter(Boolean);
    }
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.itemId, patch);
  },
});

export const remove = mutation({
  args: { itemId: v.id("catalogItems") },
  handler: async (ctx, { itemId }) => {
    await requireStaff(ctx);

    const item = await ctx.db.get(itemId);
    if (!item) return;

    // Times belong to the item, so they go with it — and so do their bookings.
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .collect();

    for (const session of sessions) {
      const bookings = await ctx.db
        .query("bookings")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const booking of bookings) {
        await ctx.db.delete(booking._id);
      }
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(itemId);
  },
});
