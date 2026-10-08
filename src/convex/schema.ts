import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

// gym membership lifecycle. "cancelled" members stay on the roster for history.
export const memberStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("cancelled"),
);
export type MemberStatus = Infer<typeof memberStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // gym members tracked by the front desk. `plan` stores a plan id from
    // src/lib/gym.ts while `planPriceCents` snapshots the price at sign-up, so
    // changing the price list never rewrites an existing member's rate.
    members: defineTable({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      plan: v.string(),
      planPriceCents: v.number(),
      planStartedAt: v.number(),
      renewsAt: v.number(),
      duesAmountCents: v.number(),
      duesDueAt: v.optional(v.number()),
      status: memberStatusValidator,
      joinedAt: v.number(),
      note: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_status", ["status"])
      .index("by_name", ["name"]),

    // one row per visit recorded at the desk.
    checkIns: defineTable({
      memberId: v.id("members"),
      at: v.number(),
      recordedBy: v.id("users"),
    })
      .index("by_member", ["memberId"])
      .index("by_member_at", ["memberId", "at"])
      .index("by_at", ["at"]),

    // small key/value store, currently used to remember that the sample roster
    // was loaded so deleting every member does not silently re-seed it.
    meta: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
