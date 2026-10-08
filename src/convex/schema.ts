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

// how a catalog item is charged.
export const cadenceValidator = v.union(
  v.literal("one_time"),
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("annual"),
);
export type Cadence = Infer<typeof cadenceValidator>;

// catalog items are drafts until an operator publishes them.
export const catalogStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived"),
);
export type CatalogStatus = Infer<typeof catalogStatusValidator>;

export const bookingStatusValidator = v.union(
  v.literal("booked"),
  v.literal("attended"),
  v.literal("cancelled"),
);
export type BookingStatus = Infer<typeof bookingStatusValidator>;

export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("paid"),
  v.literal("refunded"),
  v.literal("cancelled"),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

export const postKindValidator = v.union(
  v.literal("announcement"),
  v.literal("update"),
  v.literal("note"),
);
export type PostKind = Infer<typeof postKindValidator>;

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

    // the catalog sold by this workspace: memberships, class packs, day passes,
    // add-ons. `priceCents` is the workspace's own list price.
    catalogItems: defineTable({
      name: v.string(),
      slug: v.string(),
      tagline: v.string(),
      description: v.string(),
      category: v.string(),
      priceCents: v.number(),
      cadence: cadenceValidator,
      capacity: v.number(),
      features: v.array(v.string()),
      status: catalogStatusValidator,
      createdBy: v.id("users"),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_category", ["category"])
      .index("by_slug", ["slug"]),

    // bookable times: a class, an induction, a court hour.
    sessions: defineTable({
      itemId: v.optional(v.id("catalogItems")),
      title: v.string(),
      coach: v.string(),
      room: v.string(),
      startsAt: v.number(),
      durationMinutes: v.number(),
      capacity: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_startsAt", ["startsAt"])
      .index("by_item", ["itemId"]),

    // one row per booking, cancelled rows kept so history survives.
    bookings: defineTable({
      sessionId: v.id("sessions"),
      userId: v.id("users"),
      memberId: v.optional(v.id("members")),
      status: bookingStatusValidator,
      createdAt: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_user", ["userId"])
      .index("by_session_user", ["sessionId", "userId"]),

    // checkout records. A gateway can be connected later; until then an order
    // is either paid in the sandbox or left pending for the desk to collect.
    orders: defineTable({
      itemId: v.id("catalogItems"),
      itemName: v.string(),
      userId: v.id("users"),
      memberId: v.optional(v.id("members")),
      amountCents: v.number(),
      status: orderStatusValidator,
      method: v.union(v.literal("sandbox_card"), v.literal("desk")),
      provider: v.string(),
      reference: v.string(),
      createdAt: v.number(),
      paidAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

    // workspace content: announcements with an optional uploaded image.
    posts: defineTable({
      title: v.string(),
      body: v.string(),
      kind: postKindValidator,
      imageId: v.optional(v.id("_storage")),
      published: v.boolean(),
      authorId: v.id("users"),
      authorName: v.string(),
    })
      .index("by_published", ["published"])
      .index("by_author", ["authorId"]),

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
