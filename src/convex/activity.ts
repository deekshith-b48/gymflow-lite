import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { auditCategoryValidator, auditEventValidator } from "./schema";
import { requireStaff } from "./staff";

/**
 * One writer for the audit trail. Every mutation that changes something the
 * owner would ask about ("who removed this member?") calls this so the activity
 * log stays complete without each module reinventing the row shape.
 */
export async function logActivity(
  ctx: MutationCtx,
  args: {
    event: "auth" | "created" | "updated" | "deleted" | "other";
    category:
      | "members"
      | "payments"
      | "expenses"
      | "sales"
      | "withdrawals"
      | "packages"
      | "addons"
      | "roles"
      | "staff"
      | "settings"
      | "auth"
      | "attendance"
      | "other";
    activity: string;
  },
) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  await ctx.db.insert("activityLog", {
    at: Date.now(),
    userId: userId ?? undefined,
    userName: user?.name ?? user?.email ?? "Signed-in user",
    userEmail: user?.email ?? undefined,
    event: args.event,
    category: args.category,
    activity: args.activity,
  });
}

/**
 * The activity log page: newest first, filtered by search term, module
 * category, event type and an optional time window chosen on the client.
 */
export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    event: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const term = args.search?.trim().toLowerCase() ?? "";
    const rows = await ctx.db
      .query("activityLog")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min(args.limit ?? 500, 1000));

    const items = rows
      .filter((row) => {
        if (args.category && args.category !== "all" && row.category !== args.category)
          return false;
        if (args.event && args.event !== "all" && row.event !== args.event)
          return false;
        if (args.from !== undefined && row.at < args.from) return false;
        if (args.to !== undefined && row.at > args.to) return false;
        if (!term) return true;
        return (
          row.activity.toLowerCase().includes(term) ||
          row.userName.toLowerCase().includes(term) ||
          (row.userEmail ?? "").toLowerCase().includes(term)
        );
      })
      .map((row) => ({
        _id: row._id,
        at: row.at,
        userName: row.userName,
        userEmail: row.userEmail,
        event: row.event,
        category: row.category,
        activity: row.activity,
      }));

    return { items, total: items.length };
  },
});
