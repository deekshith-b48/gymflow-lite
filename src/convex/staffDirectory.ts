import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { roleValidator } from "./schema";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";

/**
 * The staff directory: every signed-in operator with the salary, status and
 * last-login details the Users & Staff module lists. Rows come from the auth
 * users table — one identity, not a second copy that can drift.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const users = await ctx.db.query("users").collect();

    const items = users
      .filter((user) => !user.isAnonymous)
      .map((user) => ({
        _id: user._id,
        staffCode: user.staffCode ?? null,
        name: user.name ?? user.email ?? "Unnamed",
        email: user.email ?? "",
        role: user.role ?? "user",
        staffStatus: user.staffStatus ?? "active",
        salaryCents: user.salaryCents ?? 0,
        lastLoginAt: user.lastLoginAt ?? null,
        title: user.title ?? null,
        phone: user.phone ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const stats = {
      total: items.length,
      active: items.filter((item) => item.staffStatus === "active").length,
      inactive: items.filter((item) => item.staffStatus !== "active").length,
      salaryCents: items.reduce((sum, item) => sum + item.salaryCents, 0),
    };

    return { items, stats };
  },
});

/** Invite or register a staff member: assigns the next STF-### code. */
export const add = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: roleValidator,
    salaryCents: v.number(),
    title: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const users = await ctx.db.query("users").collect();
    const existing = users.find(
      (user) => user.email?.toLowerCase() === args.email.trim().toLowerCase(),
    );
    if (existing) throw new Error("That email is already on the team.");

    const codeNumber =
      users.filter((user) => user.staffCode).length + 1;
    await logActivity(ctx, {
      event: "created",
      category: "staff",
      activity: `Added staff member ${args.name} (${args.email}) as ${args.role}`,
    });

    // The auth account itself is created when the invitee signs in; this row
    // carries the directory fields until then, keyed by email via a marker doc.
    return await ctx.db.insert("meta", {
      key: `staff_invite:${args.email.trim().toLowerCase()}`,
      value: JSON.stringify({
        name: args.name,
        role: args.role,
        salaryCents: args.salaryCents,
        title: args.title ?? "",
        phone: args.phone ?? "",
        staffCode: `STF-${String(codeNumber).padStart(3, "0")}`,
      }),
    });
  },
});

/** Update role, salary or status for an existing staff member. */
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    role: v.optional(roleValidator),
    salaryCents: v.optional(v.number()),
    staffStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("pending"),
        v.literal("inactive"),
      ),
    ),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("That staff member no longer exists.");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.role !== undefined) patch.role = args.role;
    if (args.salaryCents !== undefined) patch.salaryCents = args.salaryCents;
    if (args.staffStatus !== undefined) patch.staffStatus = args.staffStatus;
    if (args.title !== undefined) patch.title = args.title;
    await ctx.db.patch(args.userId, patch);

    await logActivity(ctx, {
      event: "updated",
      category: "staff",
      activity: `Updated staff record for ${user.name ?? user.email}`,
    });
    return args.userId;
  },
});
