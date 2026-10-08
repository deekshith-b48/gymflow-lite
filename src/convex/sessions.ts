import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./staff";

/** Seats taken, seats left and whether the signed-in operator already holds one. */
export async function withSpots(
  ctx: QueryCtx,
  session: Doc<"sessions">,
  userId: Id<"users">,
) {
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_session", (q) => q.eq("sessionId", session._id))
    .collect();

  const active = bookings.filter((booking) => booking.status !== "cancelled");
  const mine = active.find((booking) => booking.userId === userId);

  return {
    ...session,
    taken: active.length,
    spotsLeft: Math.max(0, session.capacity - active.length),
    bookedByMe: Boolean(mine),
    myBookingId: mine?._id ?? null,
  };
}

/** Upcoming sessions, soonest first. Optionally narrowed to one catalog item. */
export const list = query({
  args: {
    itemId: v.optional(v.id("catalogItems")),
    from: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    const from = args.from ?? Date.now() - 3_600_000;

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_startsAt", (q) => q.gte("startsAt", from))
      .order("asc")
      .take(100);

    const scoped = args.itemId
      ? sessions.filter((session) => session.itemId === args.itemId)
      : sessions;

    const items = await Promise.all(
      scoped.map((session) => withSpots(ctx, session, userId)),
    );

    return {
      items,
      mine: items.filter((item) => item.bookedByMe),
      stats: {
        upcoming: items.length,
        seatsLeft: items.reduce((sum, item) => sum + item.spotsLeft, 0),
        bookedByMe: items.filter((item) => item.bookedByMe).length,
        full: items.filter((item) => item.spotsLeft === 0).length,
      },
    };
  },
});

export const book = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireStaff(ctx);

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("That session no longer exists.");
    if (session.startsAt < Date.now()) {
      throw new Error("That session has already started.");
    }

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const active = bookings.filter((booking) => booking.status !== "cancelled");

    const existing = active.find((booking) => booking.userId === userId);
    if (existing) {
      return { bookingId: existing._id, alreadyBooked: true };
    }
    if (active.length >= session.capacity) {
      throw new Error("That session is full.");
    }

    const bookingId = await ctx.db.insert("bookings", {
      sessionId,
      userId,
      status: "booked",
      createdAt: Date.now(),
    });

    return { bookingId, alreadyBooked: false };
  },
});

export const cancelBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await requireStaff(ctx);

    const booking = await ctx.db.get(bookingId);
    if (!booking) return;
    if (booking.userId !== userId) {
      throw new Error("That booking belongs to another account.");
    }

    await ctx.db.patch(bookingId, { status: "cancelled" });
  },
});

export const create = mutation({
  args: {
    itemId: v.optional(v.id("catalogItems")),
    title: v.string(),
    coach: v.string(),
    room: v.string(),
    startsAt: v.number(),
    durationMinutes: v.number(),
    capacity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);

    const title = args.title.trim();
    if (!title) throw new Error("A session title is required.");
    if (args.startsAt < Date.now() - 60_000) {
      throw new Error("Pick a start time in the future.");
    }

    return await ctx.db.insert("sessions", {
      itemId: args.itemId,
      title,
      coach: args.coach.trim() || "Unassigned",
      room: args.room.trim() || "Main floor",
      startsAt: args.startsAt,
      durationMinutes: Math.max(5, Math.round(args.durationMinutes)),
      capacity: Math.max(1, Math.round(args.capacity)),
      createdBy: userId,
    });
  },
});

export const remove = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireStaff(ctx);

    const session = await ctx.db.get(sessionId);
    if (!session) return;

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const booking of bookings) {
      await ctx.db.delete(booking._id);
    }

    await ctx.db.delete(sessionId);
  },
});
