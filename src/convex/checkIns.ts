import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";

/**
 * Double taps at the desk (or an impatient tap while the first request is in
 * flight) should not create two visits, so anything inside this window reuses
 * the previous check-in.
 */
const DUPLICATE_WINDOW_MS = 60_000;

export const checkIn = mutation({
  args: {
    memberId: v.id("members"),
    source: v.optional(v.union(v.literal("machine"), v.literal("manual"))),
  },
  handler: async (ctx, { memberId, source }) => {
    const staffId = await requireStaff(ctx);

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("That member is not on the roster.");
    if (member.status === "cancelled" || member.status === "expired") {
      throw new Error("That membership is cancelled or expired.");
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
      kind: member.memberType ?? "member",
      source: source ?? "manual",
    });

    return { checkInId, at: now, duplicate: false };
  },
});

/** Punch out: stamps the member's most recent open visit. */
export const punchOut = mutation({
  args: { checkInId: v.id("checkIns") },
  handler: async (ctx, { checkInId }) => {
    await requireStaff(ctx);
    const row = await ctx.db.get(checkInId);
    if (!row) throw new Error("That check-in no longer exists.");
    if (row.punchedOutAt) return checkInId;
    await ctx.db.patch(checkInId, { punchedOutAt: Date.now() });
    return checkInId;
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

/**
 * The attendance module's table: visits enriched with member status and fee
 * state, filtered the way the spec's filter bar describes.
 */
export const log = query({
  args: {
    search: v.optional(v.string()),
    kind: v.optional(v.string()),
    status: v.optional(v.string()),
    feeStatus: v.optional(v.string()),
    source: v.optional(v.string()),
    day: v.optional(v.number()), // start-of-day timestamp, or omit for all
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = now - 30 * 86_400_000;

    const [rows, members] = await Promise.all([
      ctx.db.query("checkIns").withIndex("by_at").order("desc").take(2000),
      ctx.db.query("members").collect(),
    ]);
    const byId = new Map(members.map((member) => [member._id, member]));

    const term = args.search?.trim().toLowerCase() ?? "";
    const items = rows
      .filter((row) => {
        const member = byId.get(row.memberId);
        if (args.day !== undefined) {
          const dayEnd = args.day + 86_400_000 - 1;
          if (row.at < args.day || row.at > dayEnd) return false;
        }
        if (args.kind && args.kind !== "all" && (row.kind ?? "member") !== args.kind)
          return false;
        if (args.status && args.status !== "all" && member?.status !== args.status)
          return false;
        if (args.source && args.source !== "all" && (row.source ?? "machine") !== args.source)
          return false;
        if (args.feeStatus && args.feeStatus !== "all") {
          const state =
            member && member.duesAmountCents <= 0
              ? "paid"
              : member && (member.duesDueAt ?? 0) < now
                ? "pending"
                : "partial";
          if (state !== args.feeStatus) return false;
        }
        if (!term) return true;
        return (
          (member?.name ?? "").toLowerCase().includes(term) ||
          (member?.memberCode ?? "").toLowerCase().includes(term)
        );
      })
      .slice(0, args.limit ?? 300)
      .map((row) => {
        const member = byId.get(row.memberId);
        const duesState =
          member && member.duesAmountCents <= 0
            ? "paid"
            : member && (member.duesDueAt ?? 0) < now
              ? "pending"
              : "partial";
        return {
          _id: row._id,
          at: row.at,
          punchedOutAt: row.punchedOutAt ?? null,
          memberId: row.memberId,
          memberCode: member?.memberCode ?? "—",
          memberName: member?.name ?? "Removed member",
          kind: row.kind ?? "member",
          status: member?.status ?? "cancelled",
          feeStatus: duesState,
          source: row.source ?? "machine",
        };
      });

    const visits30d = rows.filter((row) => row.at >= thirtyDaysAgo);
    const stats = {
      today: rows.filter((row) => row.at >= todayStart.getTime()).length,
      thisMonth: rows.filter((row) => row.at >= monthStart.getTime()).length,
      dailyAverage30d: Math.round((visits30d.length / 30) * 10) / 10,
      allTime: rows.length,
    };

    return { items, stats };
  },
});

/** Daily check-in counts for the last 30 days, one point per day. */
export const dailySeries = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const since = todayStart.getTime() - 29 * 86_400_000;

    const rows = await ctx.db
      .query("checkIns")
      .withIndex("by_at", (q) => q.gte("at", since))
      .order("asc")
      .collect();

    const series: { date: number; count: number }[] = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const dayStart = todayStart.getTime() - offset * 86_400_000;
      const dayEnd = dayStart + 86_400_000 - 1;
      series.push({
        date: dayStart,
        count: rows.filter((row) => row.at >= dayStart && row.at <= dayEnd).length,
      });
    }
    return series;
  },
});
