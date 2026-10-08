import { mutation, query } from "./_generated/server";
import { requireStaff } from "./staff";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const CATALOG_SEED = [
  {
    name: "Unlimited Membership",
    tagline: "Every class, every hour, one price",
    category: "Memberships",
    priceCents: 7900,
    cadence: "monthly" as const,
    capacity: 24,
    status: "published" as const,
    description:
      "The full run of the gym: floor access whenever the doors are open, all group sessions, and a guest pass to bring someone along.",
    features: [
      "24/7 floor access",
      "All group sessions included",
      "One guest pass each month",
      "No lock-in — cancel any time",
    ],
  },
  {
    name: "Class Pack",
    tagline: "Ten sessions, ninety days, any class",
    category: "Class Packs",
    priceCents: 12000,
    cadence: "one_time" as const,
    capacity: 16,
    status: "published" as const,
    description:
      "Pay once and book into any group session. Credits stay valid for ninety days and can be used across every class type.",
    features: [
      "10 group sessions",
      "Valid for 90 days",
      "Book from any device",
    ],
  },
  {
    name: "Small Group Training",
    tagline: "Coached twice a week, never more than six",
    category: "Coaching",
    priceCents: 18000,
    cadence: "monthly" as const,
    capacity: 6,
    status: "published" as const,
    description:
      "Structured programming with a coach and a fixed group, so progress is tracked and nobody gets lost in the room.",
    features: [
      "Two coached sessions a week",
      "Maximum of six people",
      "Monthly progress check-in",
    ],
  },
  {
    name: "Onboarding & Induction",
    tagline: "Learn the room before you train in it",
    category: "Onboarding",
    priceCents: 4500,
    cadence: "one_time" as const,
    capacity: 4,
    status: "published" as const,
    description:
      "A forty-five minute session with a coach: equipment walkthrough, movement screen and a first plan to work from.",
    features: [
      "Equipment walkthrough",
      "Goal setting session",
      "45 minutes with a coach",
    ],
  },
  {
    name: "Day Pass",
    tagline: "One visit on your terms",
    category: "Day Passes",
    priceCents: 1800,
    cadence: "one_time" as const,
    capacity: 30,
    status: "published" as const,
    description:
      "Full access to the floor for a single visit, with a locker and towel included.",
    features: ["Full floor access", "Locker and towel", "One visit"],
  },
  {
    name: "Yoga & Mobility",
    tagline: "Eight slower sessions a month",
    category: "Class Packs",
    priceCents: 9500,
    cadence: "monthly" as const,
    capacity: 20,
    status: "draft" as const,
    description:
      "A calmer track for recovery weeks: mobility work, breath and flow, capped at twenty people per class.",
    features: ["Eight flow sessions a month", "Mobility and recovery focus"],
  },
];

const SESSION_SEED = [
  { title: "Strength circuit", hour: 18, dayOffset: 0, coach: "Nadia Brandt", room: "Main floor", capacity: 14, minutes: 45, itemIndex: 0 },
  { title: "Morning HIIT", hour: 6, minute: 30, dayOffset: 1, coach: "Marcus Ilori", room: "Studio 2", capacity: 16, minutes: 30, itemIndex: 1 },
  { title: "Small group strength", hour: 18, dayOffset: 1, coach: "Nadia Brandt", room: "Strength room", capacity: 6, minutes: 60, itemIndex: 2 },
  { title: "Induction: new members", hour: 7, dayOffset: 2, coach: "Priya Raman", room: "Reception", capacity: 4, minutes: 45, itemIndex: 3 },
  { title: "Evening flow", hour: 19, minute: 30, dayOffset: 2, coach: "Sofia Lindgren", room: "Studio 1", capacity: 20, minutes: 60, itemIndex: 5 },
  { title: "Open floor coaching", hour: 12, minute: 15, dayOffset: 3, coach: "Marcus Ilori", room: "Main floor", capacity: 12, minutes: 45, itemIndex: 0 },
];

export const status = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);

    const [roster, workspace] = await Promise.all([
      ctx.db
        .query("meta")
        .withIndex("by_key", (q) => q.eq("key", "demo-seeded"))
        .first(),
      ctx.db
        .query("meta")
        .withIndex("by_key", (q) => q.eq("key", "workspace-seeded"))
        .first(),
    ]);

    return {
      rosterSeeded: Boolean(roster),
      workspaceSeeded: Boolean(workspace),
      ready: Boolean(roster && workspace),
    };
  },
});

/**
 * Fills a brand-new workspace with a catalog, a week of sessions, a few orders
 * and two posts, so every screen has something real in it on first load. Runs
 * once; the `meta` flag keeps it from coming back if the operator clears it.
 */
export const workspace = mutation({
  args: {},
  handler: async (ctx) => {
    const staffId = await requireStaff(ctx);
    const now = Date.now();

    const flag = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "workspace-seeded"))
      .first();
    if (flag) return { seeded: false };

    const existing = await ctx.db.query("catalogItems").first();
    if (existing) {
      await ctx.db.insert("meta", {
        key: "workspace-seeded",
        value: String(now),
      });
      return { seeded: false };
    }

    const items = [];
    for (const [index, seed] of CATALOG_SEED.entries()) {
      const itemId = await ctx.db.insert("catalogItems", {
        name: seed.name,
        slug: seed.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        tagline: seed.tagline,
        description: seed.description,
        category: seed.category,
        priceCents: seed.priceCents,
        cadence: seed.cadence,
        capacity: seed.capacity,
        features: seed.features,
        status: seed.status,
        createdBy: staffId,
        updatedAt: now - index * 60_000,
      });
      items.push(itemId);
    }

    for (const session of SESSION_SEED) {
      const start = new Date(now + session.dayOffset * DAY_MS);
      start.setHours(session.hour, session.minute ?? 0, 0, 0);
      await ctx.db.insert("sessions", {
        itemId: items[session.itemIndex],
        title: session.title,
        coach: session.coach,
        room: session.room,
        startsAt: start.getTime(),
        durationMinutes: session.minutes,
        capacity: session.capacity,
        createdBy: staffId,
      });
    }

    const orderSeed = [
      { index: 0, method: "sandbox_card" as const, hoursAgo: 2 },
      { index: 4, method: "desk" as const, hoursAgo: 26 },
      { index: 1, method: "sandbox_card" as const, hoursAgo: 74 },
    ];
    for (const order of orderSeed) {
      const item = CATALOG_SEED[order.index];
      const createdAt = now - order.hoursAgo * HOUR_MS;
      const settled = order.method === "sandbox_card";
      await ctx.db.insert("orders", {
        itemId: items[order.index],
        itemName: item.name,
        userId: staffId,
        amountCents: item.priceCents,
        status: settled ? "paid" : "pending",
        method: order.method,
        provider: settled ? "sandbox" : "desk",
        reference: `GN-${createdAt.toString(36).toUpperCase().slice(-6)}`,
        createdAt,
        paidAt: settled ? createdAt : undefined,
      });
    }

    await ctx.db.insert("posts", {
      title: "New 06:30 class added to the schedule",
      body: "Morning HIIT now runs on weekdays at 06:30 in Studio 2, capped at sixteen people. Book from the schedule — it is already open.",
      kind: "announcement",
      published: true,
      authorId: staffId,
      authorName: "GymNetic operator",
    });

    await ctx.db.insert("posts", {
      title: "Locker room refresh this weekend",
      body: "Contractors are in from Saturday at 08:00 until Sunday at 16:00. Showers stay open; lockers move to the annex in the meantime.",
      kind: "update",
      published: false,
      authorId: staffId,
      authorName: "GymNetic operator",
    });

    await ctx.db.insert("meta", { key: "workspace-seeded", value: String(now) });
    return { seeded: true };
  },
});
