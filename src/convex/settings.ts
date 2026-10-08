import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";

const DEFAULT_SETTINGS = {
  key: "gym" as const,
  gymName: "Fitness Hub",
  phone: "+92 370 9062024",
  email: "hello@fithub.pk",
  address: "",
  memberPrefix: "FH",
  memberCodeCounter: 2100,
  otpReauthDays: 7,
  timezone: "Asia/Karachi",
  quietEnforced: true,
  quietFrom: "22:00",
  quietTo: "08:00",
  accentColor: "lime",
  defaultMode: "dark" as const,
  subscription: "pro" as const,
  whatsappNumber: "+923709062024",
  whatsappConnected: true,
  notificationsEnabled: true,
};

async function getSettingsDoc(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("gymSettings")
    .withIndex("by_key", (q) => q.eq("key", "gym"))
    .first();
}

/** The single settings row, created on first read so every tab has data. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const settings = await getSettingsDoc(ctx);
    if (settings) return settings;
    return {
      ...DEFAULT_SETTINGS,
      subscriptionRenewsAt: undefined,
      logoStorageId: undefined,
      updatedAt: 0,
    };
  },
});

export const update = mutation({
  args: {
    gymName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    memberPrefix: v.optional(v.string()),
    otpReauthDays: v.optional(v.number()),
    timezone: v.optional(v.string()),
    quietEnforced: v.optional(v.boolean()),
    quietFrom: v.optional(v.string()),
    quietTo: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    defaultMode: v.optional(
      v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
    ),
    subscription: v.optional(v.union(v.literal("basic"), v.literal("pro"))),
    whatsappNumber: v.optional(v.string()),
    whatsappConnected: v.optional(v.boolean()),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) patch[key] = value;
    }

    const existing = await getSettingsDoc(ctx);
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("gymSettings", {
        ...DEFAULT_SETTINGS,
        ...patch,
        updatedAt: now,
      });
    }

    if (
      args.gymName !== undefined ||
      args.memberPrefix !== undefined ||
      args.otpReauthDays !== undefined ||
      args.quietEnforced !== undefined
    ) {
      await logActivity(ctx, {
        event: "updated",
        category: "settings",
        activity: `Updated gym settings${args.gymName ? `: name set to ${args.gymName}` : ""}${args.memberPrefix ? `, ID prefix ${args.memberPrefix}` : ""}`,
      });
    } else if (args.accentColor !== undefined || args.defaultMode !== undefined) {
      await logActivity(ctx, {
        event: "updated",
        category: "settings",
        activity: `Updated appearance: accent ${args.accentColor ?? "unchanged"}, mode ${args.defaultMode ?? "unchanged"}`,
      });
    }

    return userId;
  },
});

/**
 * Allocate the next member code from the prefix counter — called when a
 * member is created so IDs like FH-2105 are never reused.
 */
export async function nextMemberCode(ctx: MutationCtx): Promise<string> {
  const settings = await getSettingsDoc(ctx);
  const prefix = settings?.memberPrefix ?? DEFAULT_SETTINGS.memberPrefix;
  const counter = (settings?.memberCodeCounter ?? DEFAULT_SETTINGS.memberCodeCounter) + 1;
  if (settings) {
    await ctx.db.patch(settings._id, { memberCodeCounter: counter });
  } else {
    await ctx.db.insert("gymSettings", {
      ...DEFAULT_SETTINGS,
      memberCodeCounter: counter,
      updatedAt: Date.now(),
    });
  }
  return `${prefix}-${counter}`;
}

/* ------------------------------------------------------------ roles */

/** Custom roles only — system roles are defined statically in lib/gym.ts. */
export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const [roles, users] = await Promise.all([
      ctx.db.query("roles").collect(),
      ctx.db.query("users").collect(),
    ]);
    return {
      items: roles
        .filter((role) => !role.isSystem)
        .map((role) => ({
          ...role,
          staffCount: users.filter(
            (user) => !user.isAnonymous && user.role === (role.name.toLowerCase() as any),
          ).length,
        })),
      staffCounts: {
        admin: users.filter((u) => !u.isAnonymous && u.role === "admin").length,
        manager: users.filter((u) => !u.isAnonymous && u.role === "manager").length,
        receptionist: users.filter(
          (u) => !u.isAnonymous && u.role === "receptionist",
        ).length,
        trainer: users.filter((u) => !u.isAnonymous && u.role === "trainer").length,
      },
    };
  },
});

export const upsertRole = mutation({
  args: {
    roleId: v.optional(v.id("roles")),
    name: v.string(),
    description: v.optional(v.string()),
    baseCategory: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const now = Date.now();
    const payload = {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      baseCategory: args.baseCategory,
      permissions: args.permissions,
      isSystem: false,
      updatedAt: now,
    };

    if (args.roleId) {
      await ctx.db.patch(args.roleId, payload);
      await logActivity(ctx, {
        event: "updated",
        category: "roles",
        activity: `Updated role ${payload.name} (${payload.permissions.length} permissions)`,
      });
      return args.roleId;
    }

    const roleId = await ctx.db.insert("roles", payload);
    await logActivity(ctx, {
      event: "created",
      category: "roles",
      activity: `Created role ${payload.name} based on ${args.baseCategory}`,
    });
    return roleId;
  },
});

export const removeRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    await requireStaff(ctx);
    const role = await ctx.db.get(roleId);
    if (!role) return;
    await ctx.db.delete(roleId);
    await logActivity(ctx, {
      event: "deleted",
      category: "roles",
      activity: `Deleted custom role ${role.name}`,
    });
  },
});
