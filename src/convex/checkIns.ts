import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireStaff } from "./staff";

/**
 * Double taps at the desk (or an impatient tap while the first request is in
 * flight) should not create two visits, so anything inside this window reuses
 * the previous check-in.
 */
const DUPLICATE_WINDOW_MS = 60_000;

export const checkIn = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const staffId = await requireStaff(ctx);

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("That member is not on the roster.");
    if (member.status === "cancelled") {
      throw new Error("That membership is cancelled.");
    }

    const now = Date.now();
    const previous = await ctx.db
      .query("checkIns")
      .withIndex("by_member_at", (q) => q.eq("memberId", memberId))
      .order("desc")
      .first();

    if (previous && now - previous.at < DUPLICATE_WINDOW_MS) {
      return { checkInId: previous._id, at: previous.at, duplicate: true };
    }

    const checkInId = await ctx.db.insert("checkIns", {
      memberId,
      at: now,
      recordedBy: staffId,
    });

    return { checkInId, at: now, duplicate: false };
  },
});

export const undo = mutation({
  args: { checkInId: v.id("checkIns") },
  handler: async (ctx, { checkInId }) => {
    await requireStaff(ctx);
    const checkIn = await ctx.db.get(checkInId);
    if (!checkIn) return;
    await ctx.db.delete(checkInId);
  },
});

/**
 * The day's log. `since` is sent by the client so "today" follows the desk's
 * local midnight rather than the server's.
 */
export const today = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    await requireStaff(ctx);

    const rows = await ctx.db
      .query("checkIns")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .take(200);

    const memberIds = Array.from(new Set(rows.map((row) => String(row.memberId))));
    const members = await Promise.all(
      memberIds.map((memberId) => ctx.db.get(memberId as Id<"members">)),
    );
    const byId = new Map(members.map((member) => [member?._id, member]));

    const items = rows.map((row) => {
      const member = byId.get(row.memberId);
      return {
        _id: row._id,
        at: row.at,
        memberId: row.memberId,
        memberName: member?.name ?? "Removed member",
        plan: member?.plan ?? "",
        status: member?.status ?? "cancelled",
      };
    });

    return { items, uniqueMembers: memberIds.length };
  },
});

/** Raw visit timestamps in a window, so the client can bucket them by local day. */
export const activity = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("checkIns")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("desc")
      .take(1000);
    return rows.map((row) => row.at);
  },
});
