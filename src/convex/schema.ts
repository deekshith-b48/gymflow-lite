import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
  // front-desk roles from the RBAC spec: a manager runs the day, reception
  // and trainers get the same narrow slice of the workspace.
  MANAGER: "manager",
  RECEPTIONIST: "receptionist",
  TRAINER: "trainer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.RECEPTIONIST),
  v.literal(ROLES.TRAINER),
);
export type Role = Infer<typeof roleValidator>;

// gym membership lifecycle. "cancelled" members stay on the roster for history.
// The four lifecycle states below are the ones the desk filters on; paused and
// cancelled are kept so older rows remain valid.
export const memberStatusValidator = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("expired"),
  v.literal("frozen"),
  v.literal("paused"),
  v.literal("cancelled"),
);
export type MemberStatus = Infer<typeof memberStatusValidator>;

// payment lifecycle for fee records, sales and expenses.
export const paymentStatusValidator = v.union(
  v.literal("paid"),
  v.literal("partial"),
  v.literal("pending"),
);

// how a fee or sale was settled.
export const payMethodValidator = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("card"),
  v.literal("online"),
);

// fee record kinds: a membership cycle, an add-on, or personal training.
export const feeKindValidator = v.union(
  v.literal("membership"),
  v.literal("addon"),
  v.literal("pt"),
);

// audit event shape for the activity log.
export const auditEventValidator = v.union(
  v.literal("auth"),
  v.literal("created"),
  v.literal("updated"),
  v.literal("deleted"),
  v.literal("other"),
);

// audit bucket — which module an activity row belongs to.
export const auditCategoryValidator = v.union(
  v.literal("members"),
  v.literal("payments"),
  v.literal("expenses"),
  v.literal("sales"),
  v.literal("withdrawals"),
  v.literal("packages"),
  v.literal("addons"),
  v.literal("roles"),
  v.literal("staff"),
  v.literal("settings"),
  v.literal("auth"),
  v.literal("attendance"),
  v.literal("other"),
);

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

      // staff directory extras: the desk lists salary, status and last login
      // next to the auth record instead of keeping a second users table.
      staffCode: v.optional(v.string()), // auto "STF-001"
      salaryCents: v.optional(v.number()), // monthly salary in PKR paisa
      staffStatus: v.optional(
        v.union(v.literal("active"), v.literal("pending"), v.literal("inactive")),
      ),
      lastLoginAt: v.optional(v.number()),
      title: v.optional(v.string()), // e.g. "Trainer", "Front desk"
      phone: v.optional(v.string()),
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

      // profile extras for the members module.
      memberCode: v.optional(v.string()), // auto "FH-2097" from gymSettings prefix
      gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
      dob: v.optional(v.number()),
      cnic: v.optional(v.string()),
      address: v.optional(v.string()),
      memberType: v.optional(
        v.union(v.literal("member"), v.literal("staff")),
      ),
      regFeeCents: v.optional(v.number()), // registration fee collected
      addOns: v.optional(v.array(v.string())), // add-on names assigned
      photoStorageId: v.optional(v.id("_storage")),
      frozenAt: v.optional(v.number()), // when the membership was frozen
      trainerId: v.optional(v.id("trainers")),
      packageId: v.optional(v.id("packages")),
    })
      .index("by_status", ["status"])
      .index("by_name", ["name"]),

    // one row per visit recorded at the desk.
    checkIns: defineTable({
      memberId: v.id("members"),
      at: v.number(),
      recordedBy: v.id("users"),
      kind: v.optional(v.union(v.literal("member"), v.literal("staff"))),
      source: v.optional(v.union(v.literal("machine"), v.literal("manual"))),
      punchedOutAt: v.optional(v.number()),
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

    /* ------------------------------------------------- gym management module */

    // sellable memberships & PT packages, distinct from the storefront catalog:
    // these carry duration, registration fee and PT fee for the fee module.
    packages: defineTable({
      name: v.string(),
      kind: v.union(v.literal("gym"), v.literal("pt")),
      durationMonths: v.number(),
      gymFeeCents: v.number(),
      regFeeCents: v.number(),
      ptFeeCents: v.number(),
      includeGymFee: v.boolean(),
      includeRegFee: v.boolean(),
      includePtFee: v.boolean(),
      details: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("archived")),
      createdBy: v.optional(v.id("users")),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_kind", ["kind"]),

    // add-on services (locker, sauna, supplements) assigned to members.
    addOns: defineTable({
      name: v.string(),
      priceCents: v.number(),
      details: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("archived")),
      updatedAt: v.number(),
    }).index("by_status", ["status"]),

    // personal trainers on staff: commission % drives their payment history.
    trainers: defineTable({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      specialty: v.optional(v.string()),
      status: v.union(v.literal("active"), v.literal("inactive")),
      commissionBps: v.number(), // basis points, e.g. 1200 = 12%
      salaryCents: v.number(),
      userId: v.optional(v.id("users")),
      joinedAt: v.number(),
      updatedAt: v.number(),
    }).index("by_status", ["status"]),

    // one row per fee collection: membership cycle, add-on or PT session.
    feeRecords: defineTable({
      memberId: v.id("members"),
      memberCode: v.optional(v.string()),
      memberName: v.string(),
      packageId: v.optional(v.id("packages")),
      packageName: v.optional(v.string()),
      kind: feeKindValidator,
      trainerId: v.optional(v.id("trainers")),
      periodStart: v.number(),
      periodEnd: v.number(),
      totalCents: v.number(),
      packageFeeCents: v.number(),
      ptFeeCents: v.optional(v.number()),
      discountCents: v.optional(v.number()),
      paidCents: v.number(),
      balanceCents: v.number(),
      method: payMethodValidator,
      status: paymentStatusValidator,
      paymentDate: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdBy: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_member", ["memberId"])
      .index("by_status", ["status"])
      .index("by_paymentDate", ["paymentDate"])
      .index("by_periodStart", ["periodStart"]),

    // POS-style product sales: supplements, accessories, apparel, beverages.
    sales: defineTable({
      date: v.number(),
      category: v.string(),
      description: v.optional(v.string()),
      amountCents: v.number(),
      method: payMethodValidator,
      status: paymentStatusValidator,
      recordedById: v.optional(v.id("users")),
      recordedByName: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_category", ["category"]),

    // operating expenses: rent, salaries, utilities, PT commission, etc.
    expenses: defineTable({
      date: v.number(),
      category: v.string(),
      description: v.optional(v.string()),
      amountCents: v.number(),
      status: v.union(v.literal("paid"), v.literal("pending")),
      loggedById: v.optional(v.id("users")),
      loggedByName: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_category", ["category"]),

    // cash draws taken out of the till by an owner.
    withdrawals: defineTable({
      date: v.number(),
      amountCents: v.number(),
      description: v.optional(v.string()),
      withdrawnByName: v.optional(v.string()),
      recordedById: v.optional(v.id("users")),
      recordedByName: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_date", ["date"]),

    // the workspace's own audit trail: one row per meaningful action.
    activityLog: defineTable({
      at: v.number(),
      userId: v.optional(v.id("users")),
      userName: v.string(),
      userEmail: v.optional(v.string()),
      event: auditEventValidator,
      category: auditCategoryValidator,
      activity: v.string(),
    })
      .index("by_at", ["at"])
      .index("by_category", ["category"])
      .index("by_event", ["event"]),

    // single-row-per-workspace settings: gym profile, ID prefix, OTP window,
    // quiet hours, accent colour, subscription and WhatsApp connection.
    gymSettings: defineTable({
      key: v.literal("gym"),
      gymName: v.string(),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      address: v.optional(v.string()),
      logoStorageId: v.optional(v.id("_storage")),
      memberPrefix: v.string(), // "FH" → FH-1001
      memberCodeCounter: v.number(),
      otpReauthDays: v.number(), // 0 = never ask again
      timezone: v.string(), // "Asia/Karachi"
      quietEnforced: v.boolean(),
      quietFrom: v.string(), // "HH:MM"
      quietTo: v.string(), // "HH:MM"
      accentColor: v.string(), // hex or preset name
      defaultMode: v.union(
        v.literal("system"),
        v.literal("light"),
        v.literal("dark"),
      ),
      subscription: v.union(
        v.literal("basic"),
        v.literal("pro"),
      ),
      subscriptionRenewsAt: v.optional(v.number()),
      whatsappNumber: v.optional(v.string()),
      whatsappConnected: v.boolean(),
      notificationsEnabled: v.boolean(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // custom RBAC roles created by the admin (system roles are static).
    roles: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      baseCategory: v.string(), // maps to legacy role string
      permissions: v.array(v.string()), // "members.view" style keys
      isSystem: v.boolean(),
      updatedAt: v.number(),
    })
      .index("by_name", ["name"])
      .index("by_system", ["isSystem"]),

    // automated notification rules with per-rule toggles.
    notificationRules: defineTable({
      key: v.string(), // "expiry", "inactive", "payment", "welcome"
      name: v.string(),
      description: v.string(),
      triggers: v.array(v.string()),
      channels: v.array(v.union(v.literal("email"), v.literal("whatsapp"))),
      templateKey: v.string(),
      enabled: v.boolean(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // centrally managed message templates (system-owned).
    notificationTemplates: defineTable({
      key: v.string(), // "birthday", "expiry", "closure", ...
      name: v.string(),
      channels: v.array(v.union(v.literal("email"), v.literal("whatsapp"))),
      subject: v.optional(v.string()),
      body: v.string(),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // outbox: every message sent or queued, automated or manual.
    messageHistory: defineTable({
      at: v.number(),
      type: v.union(v.literal("automated"), v.literal("manual")),
      trigger: v.string(),
      channel: v.union(v.literal("email"), v.literal("whatsapp")),
      recipients: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("failed"),
      ),
      subject: v.optional(v.string()),
      audience: v.optional(v.string()),
    }).index("by_at", ["at"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
