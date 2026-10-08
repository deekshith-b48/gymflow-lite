import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireStaff } from "./staff";

const DAY_MS = 86_400_000;

/**
 * Fills the gym-management half of the workspace — packages, trainers, fee
 * records, sales, expenses, withdrawals and ~90 days of visit history — so the
 * dashboard's KPIs, donuts and rush-hour chart open with real-looking data
 * instead of empty states. Runs once per workspace behind a `meta` flag.
 *
 * Amounts are paisa (1/100 rupee): Rs 5,000 → 500_000.
 */
export const finance = mutation({
  args: {},
  handler: async (ctx) => {
    const staffId = await requireStaff(ctx);
    const now = Date.now();

    const flag = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "finance-seeded"))
      .first();
    if (flag) return { seeded: false };

    const existingFees = await ctx.db.query("feeRecords").first();
    if (existingFees) {
      await ctx.db.insert("meta", { key: "finance-seeded", value: String(now) });
      return { seeded: false };
    }

    const members = await ctx.db.query("members").collect();
    if (members.length === 0) {
      // The roster seeds in the same pass — try again on the next load.
      return { seeded: false };
    }

    /* ------------------------------------------------- packages */
    const packageIds: Record<string, Id<"packages">> = {};
    const pkgSeed = [
      {
        name: "Monthly Basic",
        kind: "gym" as const,
        durationMonths: 1,
        gymFeeCents: 500_000,
        regFeeCents: 200_000,
        ptFeeCents: 0,
        details: "Full floor access, all group classes, month to month.",
      },
      {
        name: "PT Premium",
        kind: "pt" as const,
        durationMonths: 1,
        gymFeeCents: 800_000,
        regFeeCents: 200_000,
        ptFeeCents: 1_200_000,
        details: "Gym access plus four one-to-one sessions with a trainer.",
      },
      {
        name: "Quarterly Pro",
        kind: "gym" as const,
        durationMonths: 3,
        gymFeeCents: 1_350_000,
        regFeeCents: 200_000,
        ptFeeCents: 0,
        details: "Three months up front — save on the monthly rate.",
      },
    ];
    for (const seed of pkgSeed) {
      const id = await ctx.db.insert("packages", {
        ...seed,
        includeGymFee: true,
        includeRegFee: true,
        includePtFee: seed.ptFeeCents > 0,
        status: "active" as const,
        createdBy: staffId,
        updatedAt: now,
      });
      packageIds[seed.name] = id;
    }

    await ctx.db.insert("addOns", {
      name: "Locker rental",
      priceCents: 5_000,
      details: "Personal locker, monthly",
      status: "active" as const,
      updatedAt: now,
    });
    await ctx.db.insert("addOns", {
      name: "Sauna access",
      priceCents: 1_500,
      details: "Per visit",
      status: "active" as const,
      updatedAt: now,
    });

    /* ------------------------------------------------- trainers */
    const trainerSara = await ctx.db.insert("trainers", {
      name: "Sara Khan",
      email: "sara@gym.pk",
      phone: "300 1122334",
      specialty: "HIIT & Functional",
      status: "active" as const,
      commissionBps: 1200,
      salaryCents: 4_000_000,
      joinedAt: now - 400 * DAY_MS,
      updatedAt: now,
    });
    const trainerAhmed = await ctx.db.insert("trainers", {
      name: "Ahmed Raza",
      email: "ahmed@gym.pk",
      phone: "333 4455667",
      specialty: "Strength & Conditioning",
      status: "active" as const,
      commissionBps: 1500,
      salaryCents: 4_500_000,
      joinedAt: now - 260 * DAY_MS,
      updatedAt: now,
    });

    /* ------------------------------- member profile backfill */
    const pkgNames = ["Monthly Basic", "PT Premium", "Quarterly Pro"];
    for (const [index, member] of members.entries()) {
      const pkgName = pkgNames[index % pkgNames.length];
      const isPT = pkgName === "PT Premium" && index % 2 === 0;
      await ctx.db.patch(member._id, {
        memberCode: member.memberCode ?? `FH-${2091 + index}`,
        gender: member.gender ?? (index % 3 === 0 ? "female" : "male"),
        memberType: member.memberType ?? "member",
        regFeeCents: member.regFeeCents ?? 200_000,
        packageId: packageIds[pkgName],
        trainerId: isPT
          ? index % 4 === 0
            ? trainerSara
            : trainerAhmed
          : undefined,
        addOns:
          member.addOns ?? (index % 5 === 0 ? ["Locker rental"] : undefined),
        status:
          index > 0 && index % 9 === 0
            ? "expired"
            : index % 11 === 0
              ? "frozen"
              : member.status === "paused"
                ? "frozen"
                : "active",
      });
    }

    /* ---------------------------------------------- fee records */
    const methodCycle = ["cash", "bank", "card", "online"] as const;
    let partialCounter = 0;
    for (const [index, member] of members.entries()) {
      const pkgName = pkgNames[index % pkgNames.length];        const pkg = await ctx.db.get(packageIds[pkgName]);
        if (!pkg) continue;

      const cycles = pkg.durationMonths >= 3 ? 2 : 3;
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const periodEnd = now - cycle * pkg.durationMonths * 30 * DAY_MS;
        const periodStart = periodEnd - pkg.durationMonths * 30 * DAY_MS;
        if (periodStart > now) continue;

        const totalCents = pkg.gymFeeCents + (pkg.ptFeeCents ?? 0);
        const isPartial = partialCounter < 3 && cycle === 0;
        const paidCents = isPartial
          ? Math.round(totalCents * 0.7)
          : totalCents;
        if (isPartial) partialCounter += 1;
        const balanceCents = totalCents - paidCents;
        const trainerId =
          (pkg.ptFeeCents ?? 0) > 0
            ? index % 4 === 0
              ? trainerSara
              : trainerAhmed
            : undefined;

        await ctx.db.insert("feeRecords", {
          memberId: member._id,
          memberCode: member.memberCode ?? `FH-${2091 + index}`,
          memberName: member.name,
          packageId: packageIds[pkgName],
          packageName: pkg.name,
          kind: (pkg.ptFeeCents ?? 0) > 0 ? "pt" : "membership",
          trainerId,
          periodStart,
          periodEnd,
          totalCents,
          packageFeeCents: pkg.gymFeeCents,
          ptFeeCents: (pkg.ptFeeCents ?? 0) || undefined,
          paidCents,
          balanceCents,
          method: methodCycle[index % methodCycle.length],
          status: balanceCents === 0 ? "paid" : "partial",
          paymentDate: periodStart + DAY_MS,
          createdBy: staffId,
          createdAt: periodStart,
        });
      }

      // Registration fee, collected once at sign-up.
      await ctx.db.insert("feeRecords", {
        memberId: member._id,
        memberCode: member.memberCode ?? `FH-${2091 + index}`,
        memberName: member.name,
        packageName: "Registration",
        kind: "membership",
        periodStart: member.joinedAt,
        periodEnd: member.joinedAt,
        totalCents: 200_000,
        packageFeeCents: 200_000,
        paidCents: 200_000,
        balanceCents: 0,
        method: methodCycle[index % methodCycle.length],
        status: "paid" as const,
        paymentDate: member.joinedAt,
        createdBy: staffId,
        createdAt: member.joinedAt,
      });
    }

    /* ---------------------------------------------------- sales */
    const saleSeed = [
      { daysAgo: 2, category: "Supplements", amountCents: 8_200_00, method: "cash" },
      { daysAgo: 4, category: "Supplements", amountCents: 4_600_00, method: "card" },
      { daysAgo: 7, category: "Accessories", amountCents: 3_100_00, method: "online" },
      { daysAgo: 9, category: "Beverages", amountCents: 900_00, method: "cash" },
      { daysAgo: 12, category: "Apparel", amountCents: 5_400_00, method: "bank" },
      { daysAgo: 16, category: "Supplements", amountCents: 6_700_00, method: "cash" },
      { daysAgo: 21, category: "Accessories", amountCents: 2_200_00, method: "card" },
      { daysAgo: 26, category: "Beverages", amountCents: 1_100_00, method: "cash" },
      { daysAgo: 33, category: "Supplements", amountCents: 9_300_00, method: "online" },
      { daysAgo: 41, category: "Apparel", amountCents: 4_000_00, method: "cash" },
      { daysAgo: 52, category: "Accessories", amountCents: 2_800_00, method: "card" },
      { daysAgo: 64, category: "Supplements", amountCents: 7_500_00, method: "bank" },
      { daysAgo: 78, category: "Beverages", amountCents: 1_400_00, method: "cash" },
    ];
    for (const [index, sale] of saleSeed.entries()) {
      const date = now - sale.daysAgo * DAY_MS;
      await ctx.db.insert("sales", {
        date,
        category: sale.category,
        description:
          sale.category === "Supplements"
            ? "Whey protein & creatine"
            : sale.category === "Accessories"
              ? "Lifting grips & straps"
              : sale.category === "Apparel"
                ? "Gym tee & shorts"
                : "Protein shake bar",
        amountCents: sale.amountCents,
        method: sale.method as "cash" | "bank" | "card" | "online",
        status: "paid" as const,
        recordedById: staffId,
        recordedByName: "Front desk",
        createdAt: date,
      });
      void index;
    }

    /* ------------------------------------------------- expenses */
    const expenseSeed: {
      daysAgo: number;
      category: string;
      description: string;
      amountCents: number;
    }[] = [];
    // Rent + salaries every month for the last six months.
    for (let month = 0; month < 6; month += 1) {
      const base = month * 30;
      expenseSeed.push(
        {
          daysAgo: base + 2,
          category: "Rent",
          description: "Plaza shop rent",
          amountCents: 1_350_000,
        },
        {
          daysAgo: base + 3,
          category: "Salaries",
          description: "Staff salaries",
          amountCents: 1_300_000,
        },
        {
          daysAgo: base + 8,
          category: "Electricity",
          description: "LESCO bill",
          amountCents: 285_000,
        },
      );
    }
    expenseSeed.push(
      { daysAgo: 5, category: "Equipment", description: "New dumbbell set", amountCents: 450_000 },
      { daysAgo: 11, category: "Marketing", description: "Instagram campaign", amountCents: 250_000 },
      { daysAgo: 14, category: "PT Commission", description: "Trainer commission payout", amountCents: 140_400 },
      { daysAgo: 19, category: "Maintenance", description: "Treadmill servicing", amountCents: 120_000 },
      { daysAgo: 24, category: "Internet", description: "Fiber internet", amountCents: 65_000 },
      { daysAgo: 27, category: "Water", description: "Water tanker", amountCents: 42_000 },
      { daysAgo: 35, category: "Other", description: "Cleaning supplies", amountCents: 80_000 },
    );
    for (const expense of expenseSeed) {
      const date = now - expense.daysAgo * DAY_MS;
      await ctx.db.insert("expenses", {
        date,
        category: expense.category,
        description: expense.description,
        amountCents: expense.amountCents,
        status: "paid" as const,
        loggedById: staffId,
        loggedByName: "Owner",
        createdAt: date,
      });
    }

    /* ------------------------------------------------ withdrawals */
    await ctx.db.insert("withdrawals", {
      date: now - 6 * DAY_MS,
      amountCents: 200_000,
      description: "Rent to plaza",
      withdrawnByName: "Owner",
      recordedById: staffId,
      recordedByName: "Owner",
      createdAt: now - 6 * DAY_MS,
    });
    await ctx.db.insert("withdrawals", {
      date: now - 38 * DAY_MS,
      amountCents: 500_000,
      description: "Personal draw",
      withdrawnByName: "Owner",
      recordedById: staffId,
      recordedByName: "Owner",
      createdAt: now - 38 * DAY_MS,
    });

    /* ------------------------------------------- visit history */
    // ~90 days of visits weighted toward lunchtime and late evening — the
    // rush-hour chart should peak at 12–14 and 22–23 like the spec's.
    const HOUR_WEIGHTS = [
      2, 1, 1, 1, 1, 2, 4, 6, 5, 4, 5, 7, 10, 10, 8, 6, 6, 7, 8, 7, 5, 6, 9, 9,
    ];
    const totalWeight = HOUR_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
    let inserted = 0;
    let cursor = 0;

    function pickHour(seed: number) {
      let acc = 0;
      const target = (seed % 1000) / 1000;
      for (let hour = 0; hour < 24; hour += 1) {
        acc += HOUR_WEIGHTS[hour] / totalWeight;
        if (target <= acc) return hour;
      }
      return 12;
    }

    for (let dayBack = 90; dayBack >= 0; dayBack -= 1) {
      const dayStart = now - dayBack * DAY_MS;
      const date = new Date(dayStart);
      date.setHours(0, 0, 0, 0);
      const weekday = date.getDay();
      const dailyVisits = weekday === 0 ? 2 : 4 + ((dayBack * 7) % 4);

      for (let visit = 0; visit < dailyVisits; visit += 1) {
        cursor += 1;
        const hour = pickHour(cursor * 37);
        const at = date.getTime() + hour * 3_600_000 + ((cursor * 13) % 50) * 60_000;
        if (at > now) continue;
        const member = members[(cursor * 5) % members.length];
        await ctx.db.insert("checkIns", {
          memberId: member._id,
          at,
          recordedBy: staffId,
          kind: "member" as const,
          source: cursor % 3 === 0 ? ("manual" as const) : ("machine" as const),
        });
        inserted += 1;
      }
    }

    /* ---------------------------------------------- audit trail */
    await ctx.db.insert("activityLog", {
      at: now - DAY_MS,
      userName: "System",
      event: "created" as const,
      category: "settings" as const,
      activity: "Workspace provisioned with demo finance data",
    });

    await ctx.db.insert("meta", { key: "finance-seeded", value: String(now) });
    return { seeded: true, checkInsInserted: inserted };
  },
});
