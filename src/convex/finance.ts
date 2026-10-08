import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  feeKindValidator,
  memberStatusValidator,
  payMethodValidator,
  paymentStatusValidator,
} from "./schema";
import { logActivity } from "./activity";
import { requireStaff } from "./staff";
import { paymentStatus, startOfDay } from "../lib/gym";

const DAY_MS = 86_400_000;

/* --------------------------------------------------------------- fees */

/** Fee records with the desk's filters: search, status, kind, date window. */
export const listFees = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    kind: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("feeRecords").order("desc").take(1000);
    const term = args.search?.trim().toLowerCase() ?? "";

    const items = rows
      .filter((row) => {
        if (args.status && args.status !== "all" && row.status !== args.status)
          return false;
        if (args.kind && args.kind !== "all" && row.kind !== args.kind)
          return false;
        const paidAt = row.paymentDate ?? row.createdAt;
        if (args.from !== undefined && paidAt < args.from) return false;
        if (args.to !== undefined && paidAt > args.to) return false;
        if (!term) return true;
        return (
          row.memberName.toLowerCase().includes(term) ||
          (row.memberCode ?? "").toLowerCase().includes(term)
        );
      });

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const inMonth = rows.filter(
      (row) => (row.paymentDate ?? row.createdAt) >= monthStart.getTime(),
    );

    const stats = {
      collectedThisMonthCents: inMonth.reduce(
        (sum, row) => sum + row.paidCents,
        0,
      ),
      pendingCents: rows
        .filter((row) => row.status === "pending")
        .reduce((sum, row) => sum + row.balanceCents, 0),
      partialBalanceCents: rows
        .filter((row) => row.status === "partial")
        .reduce((sum, row) => sum + row.balanceCents, 0),
      totalCollectedCents: rows.reduce((sum, row) => sum + row.paidCents, 0),
      collectedCount: rows.filter((row) => row.status === "paid").length,
      partialCount: rows.filter((row) => row.status === "partial").length,
      pendingCount: rows.filter((row) => row.status === "pending").length,
      outstandingCents: rows.reduce(
        (sum, row) => sum + Math.max(0, row.balanceCents),
        0,
      ),
      now,
    };

    return { items, stats };
  },
});

/** The unpaid-fee alert shown while picking a member in the add-fee modal. */
export const memberOpenFees = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("feeRecords")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")
      .collect();
    const open = rows.filter((row) => row.status !== "paid");
    return {
      count: open.length,
      items: open.map((row) => ({
        _id: row._id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        balanceCents: row.balanceCents,
        status: row.status,
      })),
    };
  },
});

/** One member's full payment history for the detail page's Payments tab. */
export const memberFees = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("feeRecords")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")
      .collect();

    const member = await ctx.db.get(memberId);
    const outstandingCents = rows.reduce(
      (sum, row) => sum + Math.max(0, row.balanceCents),
      0,
    );

    return {
      items: rows.map((row) => ({
        _id: row._id,
        kind: row.kind,
        packageName: row.packageName ?? null,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        totalCents: row.totalCents,
        packageFeeCents: row.packageFeeCents,
        ptFeeCents: row.ptFeeCents ?? 0,
        discountCents: row.discountCents ?? 0,
        paidCents: row.paidCents,
        balanceCents: row.balanceCents,
        method: row.method,
        status: row.status,
        paymentDate: row.paymentDate ?? row.createdAt,
      })),
      stats: {
        totalPaidCents: rows.reduce((sum, row) => sum + row.paidCents, 0),
        outstandingCents:
          outstandingCents + Math.max(0, member?.duesAmountCents ?? 0),
      },
    };
  },
});

export const createFee = mutation({
  args: {
    memberId: v.id("members"),
    kind: feeKindValidator,
    packageId: v.optional(v.id("packages")),
    trainerId: v.optional(v.id("trainers")),
    periodStart: v.number(),
    periodEnd: v.number(),
    packageFeeCents: v.number(),
    ptFeeCents: v.optional(v.number()),
    discountCents: v.optional(v.number()),
    totalCents: v.number(),
    paidCents: v.number(),
    method: payMethodValidator,
    paymentDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("That member is not on the roster.");
    if (args.paidCents < 0) throw new Error("Amount paid cannot be negative.");
    if (args.periodEnd < args.periodStart) {
      throw new Error("Period end must come after the period start.");
    }

    const pkg = args.packageId ? await ctx.db.get(args.packageId) : null;
    const balanceCents = Math.max(0, args.totalCents - args.paidCents);
    const status = paymentStatus(args.totalCents, args.paidCents);

    const feeRecordId = await ctx.db.insert("feeRecords", {
      memberId: args.memberId,
      memberCode: member.memberCode,
      memberName: member.name,
      packageId: args.packageId,
      packageName: pkg?.name ?? member.plan,
      kind: args.kind,
      trainerId: args.trainerId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      totalCents: args.totalCents,
      packageFeeCents: args.packageFeeCents,
      ptFeeCents: args.ptFeeCents,
      discountCents: args.discountCents,
      paidCents: args.paidCents,
      balanceCents,
      method: args.method,
      status,
      paymentDate: args.paymentDate,
      notes: args.notes?.trim() || undefined,
      createdBy: userId,
      createdAt: Date.now(),
    });

    // The roster's dues column mirrors the newest balance so the member list
    // and the fee ledger never disagree about what is owed.
    const openBalance = balanceCents;
    await ctx.db.patch(args.memberId, {
      duesAmountCents: openBalance,
      duesDueAt: openBalance > 0 ? args.periodEnd : undefined,
      ...(args.kind === "membership" && pkg
        ? {
            packageId: pkg._id,
            plan: pkg.name.toLowerCase().replace(/\s+/g, "-"),
            planPriceCents: pkg.gymFeeCents,
            planStartedAt: args.periodStart,
            renewsAt: args.periodEnd,
          }
        : {}),
    });

    await logActivity(ctx, {
      event: "created",
      category: "payments",
      activity: `Recorded ${args.kind} fee of Rs ${Math.round(args.totalCents / 100)} for ${member.name} (${status})`,
    });

    return feeRecordId;
  },
});

export const deleteFee = mutation({
  args: { feeRecordId: v.id("feeRecords") },
  handler: async (ctx, { feeRecordId }) => {
    await requireStaff(ctx);
    const record = await ctx.db.get(feeRecordId);
    if (!record) return;
    await ctx.db.delete(feeRecordId);
    await logActivity(ctx, {
      event: "deleted",
      category: "payments",
      activity: `Deleted fee record for ${record.memberName}`,
    });
  },
});

/* -------------------------------------------------------------- sales */

export const listSales = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("sales").order("desc").take(1000);
    const term = args.search?.trim().toLowerCase() ?? "";
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const items = rows.filter((row) => {
      if (args.category && args.category !== "all" && row.category !== args.category)
        return false;
      if (args.status && args.status !== "all" && row.status !== args.status)
        return false;
      if (args.from !== undefined && row.date < args.from) return false;
      if (args.to !== undefined && row.date > args.to) return false;
      if (!term) return true;
      return (
        (row.description ?? "").toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        (row.recordedByName ?? "").toLowerCase().includes(term)
      );
    });

    const thisMonth = rows.filter((row) => row.date >= monthStart.getTime());
    const byCategory = new Map<string, number>();
    for (const row of thisMonth) {
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amountCents);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    const stats = {
      thisMonthCents: thisMonth.reduce((sum, row) => sum + row.amountCents, 0),
      count: thisMonth.length,
      topCategory: topCategory?.[0] ?? null,
      topCategoryCents: topCategory?.[1] ?? 0,
      pendingCents: rows
        .filter((row) => row.status !== "paid")
        .reduce((sum, row) => sum + row.amountCents, 0),
    };

    return { items, stats };
  },
});

export const createSale = mutation({
  args: {
    date: v.number(),
    category: v.string(),
    description: v.optional(v.string()),
    amountCents: v.number(),
    method: payMethodValidator,
    status: paymentStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    if (args.amountCents <= 0) throw new Error("Sale amount must be positive.");
    const user = await ctx.db.get(userId);

    const saleId = await ctx.db.insert("sales", {
      date: args.date,
      category: args.category,
      description: args.description?.trim() || undefined,
      amountCents: args.amountCents,
      method: args.method,
      status: args.status,
      recordedById: userId,
      recordedByName: user?.name ?? user?.email ?? "Staff",
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      event: "created",
      category: "sales",
      activity: `Recorded ${args.category} sale of Rs ${Math.round(args.amountCents / 100)}`,
    });
    return saleId;
  },
});

export const deleteSale = mutation({
  args: { saleId: v.id("sales") },
  handler: async (ctx, { saleId }) => {
    await requireStaff(ctx);
    const row = await ctx.db.get(saleId);
    if (!row) return;
    await ctx.db.delete(saleId);
    await logActivity(ctx, {
      event: "deleted",
      category: "sales",
      activity: `Deleted ${row.category} sale of Rs ${Math.round(row.amountCents / 100)}`,
    });
  },
});

/* ----------------------------------------------------------- expenses */

export const listExpenses = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("expenses").order("desc").take(1000);
    const term = args.search?.trim().toLowerCase() ?? "";
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

    const items = rows.filter((row) => {
      if (args.category && args.category !== "all" && row.category !== args.category)
        return false;
      if (args.status && args.status !== "all" && row.status !== args.status)
        return false;
      if (args.from !== undefined && row.date < args.from) return false;
      if (args.to !== undefined && row.date > args.to) return false;
      if (!term) return true;
      return (
        (row.description ?? "").toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        (row.loggedByName ?? "").toLowerCase().includes(term)
      );
    });

    const thisMonth = rows.filter((row) => row.date >= monthStart);
    const byCategory = new Map<string, number>();
    for (const row of thisMonth) {
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amountCents);
    }
    const topCategory = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];

    const stats = {
      thisMonthCents: thisMonth.reduce((sum, row) => sum + row.amountCents, 0),
      thisYearCents: rows
        .filter((row) => row.date >= yearStart)
        .reduce((sum, row) => sum + row.amountCents, 0),
      topCategory: topCategory?.[0] ?? null,
      topCategoryCents: topCategory?.[1] ?? 0,
      pendingCents: rows
        .filter((row) => row.status === "pending")
        .reduce((sum, row) => sum + row.amountCents, 0),
    };

    return { items, stats };
  },
});

export const createExpense = mutation({
  args: {
    date: v.number(),
    category: v.string(),
    description: v.optional(v.string()),
    amountCents: v.number(),
    status: v.union(v.literal("paid"), v.literal("pending")),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    if (args.amountCents <= 0) throw new Error("Expense amount must be positive.");
    const user = await ctx.db.get(userId);

    const expenseId = await ctx.db.insert("expenses", {
      date: args.date,
      category: args.category,
      description: args.description?.trim() || undefined,
      amountCents: args.amountCents,
      status: args.status,
      loggedById: userId,
      loggedByName: user?.name ?? user?.email ?? "Staff",
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      event: "created",
      category: "expenses",
      activity: `Logged ${args.category} expense of Rs ${Math.round(args.amountCents / 100)}`,
    });
    return expenseId;
  },
});

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }) => {
    await requireStaff(ctx);
    const row = await ctx.db.get(expenseId);
    if (!row) return;
    await ctx.db.delete(expenseId);
    await logActivity(ctx, {
      event: "deleted",
      category: "expenses",
      activity: `Deleted ${row.category} expense of Rs ${Math.round(row.amountCents / 100)}`,
    });
  },
});

/* -------------------------------------------------------- withdrawals */

export const listWithdrawals = query({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const [rows, fees, sales, expenses] = await Promise.all([
      ctx.db.query("withdrawals").order("desc").take(1000),
      ctx.db.query("feeRecords").collect(),
      ctx.db.query("sales").collect(),
      ctx.db.query("expenses").collect(),
    ]);

    const items = rows.filter((row) => {
      if (args.from !== undefined && row.date < args.from) return false;
      if (args.to !== undefined && row.date > args.to) return false;
      return true;
    });

    const totalRevenueCents =
      fees.reduce((sum, row) => sum + row.paidCents, 0) +
      sales.reduce((sum, row) => sum + row.amountCents, 0);
    const totalExpensesCents = expenses.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    );
    const totalWithdrawnCents = rows.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    );

    return {
      items,
      stats: {
        totalRevenueCents,
        totalExpensesCents,
        totalWithdrawnCents,
        netProfitCents:
          totalRevenueCents - totalExpensesCents - totalWithdrawnCents,
      },
    };
  },
});

export const createWithdrawal = mutation({
  args: {
    date: v.number(),
    amountCents: v.number(),
    description: v.optional(v.string()),
    withdrawnByName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireStaff(ctx);
    if (args.amountCents <= 0) throw new Error("Amount must be positive.");
    const user = await ctx.db.get(userId);

    const withdrawalId = await ctx.db.insert("withdrawals", {
      date: args.date,
      amountCents: args.amountCents,
      description: args.description?.trim() || undefined,
      withdrawnByName: args.withdrawnByName?.trim() || undefined,
      recordedById: userId,
      recordedByName: user?.name ?? user?.email ?? "Staff",
      createdAt: Date.now(),
    });

    await logActivity(ctx, {
      event: "created",
      category: "withdrawals",
      activity: `Withdrew Rs ${Math.round(args.amountCents / 100)}${args.description ? ` — ${args.description}` : ""}`,
    });
    return withdrawalId;
  },
});

export const deleteWithdrawal = mutation({
  args: { withdrawalId: v.id("withdrawals") },
  handler: async (ctx, { withdrawalId }) => {
    await requireStaff(ctx);
    const row = await ctx.db.get(withdrawalId);
    if (!row) return;
    await ctx.db.delete(withdrawalId);
    await logActivity(ctx, {
      event: "deleted",
      category: "withdrawals",
      activity: `Deleted withdrawal of Rs ${Math.round(row.amountCents / 100)}`,
    });
  },
});

/* --------------------------------------------------------- dashboard */

/**
 * The dashboard's engine: one query that takes a resolved date range and
 * returns every KPI, chart series and attendance bucket the top row needs,
 * so the whole page is a single reactive subscription.
 */
export const dashboard = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    await requireStaff(ctx);
    const now = Date.now();
    const todayStart = startOfDay(now);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [members, checkIns, feeRecords, sales, expenses, withdrawals, packages] =
      await Promise.all([
        ctx.db.query("members").collect(),
        ctx.db.query("checkIns").order("desc").take(5000),
        ctx.db.query("feeRecords").collect(),
        ctx.db.query("sales").collect(),
        ctx.db.query("expenses").collect(),
        ctx.db.query("withdrawals").collect(),
        ctx.db.query("packages").collect(),
      ]);

    const rangeFees = feeRecords.filter((row) => {
      const at = row.paymentDate ?? row.createdAt;
      return at >= from && at <= to;
    });
    const rangeSales = sales.filter((row) => row.date >= from && row.date <= to);
    const rangeExpenses = expenses.filter(
      (row) => row.date >= from && row.date <= to,
    );

    const revenueCents =
      rangeFees.reduce((sum, row) => sum + row.paidCents, 0) +
      rangeSales.reduce((sum, row) => sum + row.amountCents, 0);
    const expenseCents = rangeExpenses.reduce(
      (sum, row) => sum + row.amountCents,
      0,
    );

    /* attendance summary */
    const attendance = {
      today: checkIns.filter((row) => row.at >= todayStart).length,
      thisMonth: checkIns.filter((row) => row.at >= monthStart.getTime()).length,
      allTime: checkIns.length,
    };

    /* member status donut */
    const statusCounts = {
      active: members.filter((m) => m.status === "active").length,
      inactive: members.filter((m) => m.status === "inactive").length,
      expired: members.filter((m) => m.status === "expired").length,
      frozen: members.filter(
        (m) => m.status === "frozen" || m.status === "paused",
      ).length,
    };

    /* gender split donut */
    const genderCounts = {
      male: members.filter((m) => m.gender === "male").length,
      female: members.filter((m) => m.gender === "female").length,
    };

    /* payment method donut (revenue in range, grouped by method) */
    const methodTotals = new Map<string, number>();
    for (const row of rangeFees) {
      if (row.paidCents <= 0) continue;
      methodTotals.set(row.method, (methodTotals.get(row.method) ?? 0) + row.paidCents);
    }
    for (const row of rangeSales) {
      if (row.status === "pending") continue;
      methodTotals.set(row.method, (methodTotals.get(row.method) ?? 0) + row.amountCents);
    }

    /* revenue breakdown by income stream */
    const revenueBreakdown = {
      "Membership Fees": rangeFees
        .filter((row) => row.kind === "membership")
        .reduce((sum, row) => sum + row.paidCents, 0),
      "Personal Training": rangeFees
        .filter((row) => row.kind === "pt")
        .reduce((sum, row) => sum + row.paidCents, 0),
      Registrations: members
        .filter((member) => {
          const at = member.joinedAt;
          return at >= from && at <= to;
        })
        .reduce((sum, member) => sum + (member.regFeeCents ?? 0), 0),
      Sales: rangeSales.reduce((sum, row) => sum + row.amountCents, 0),
    };

    /* expenses breakdown */
    const expenseTotals = new Map<string, number>();
    for (const row of rangeExpenses) {
      expenseTotals.set(
        row.category,
        (expenseTotals.get(row.category) ?? 0) + row.amountCents,
      );
    }

    /* fee collection rate */
    const rangeTotals = rangeFees.reduce((sum, row) => sum + row.totalCents, 0);
    const rangeCollected = rangeFees.reduce((sum, row) => sum + row.paidCents, 0);

    /* package popularity */
    const packageCounts = new Map<string, number>();
    for (const member of members) {
      const pkg = packages.find((p) => p._id === member.packageId);
      const label = pkg?.name ?? member.plan;
      packageCounts.set(label, (packageCounts.get(label) ?? 0) + 1);
    }

    /* rush hour: average check-ins per hour across the range's visits */
    const hourTotals = new Array<number>(24).fill(0);
    const hourDays = new Map<number, Set<number>>();
    const rangeVisits = checkIns.filter((row) => row.at >= from && row.at <= to);
    for (const visit of rangeVisits) {
      const hour = new Date(visit.at).getHours();
      hourTotals[hour] += 1;
      const dayKey = startOfDay(visit.at);
      if (!hourDays.has(hour)) hourDays.set(hour, new Set());
      hourDays.get(hour)!.add(dayKey);
    }
    const rushHour = hourTotals.map((total, hour) => {
      const days = hourDays.get(hour)?.size ?? 0;
      return {
        hour,
        average: days > 0 ? Math.round((total / days) * 10) / 10 : 0,
        total,
      };
    });

    /* revenue vs expenses, last 6 months */
    const monthly: { label: string; revenue: number; expenses: number }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset, 1);
      const start = date.getTime();
      const end = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        1,
      ).getTime() - 1;
      const monthRevenue =
        feeRecords
          .filter((row) => {
            const at = row.paymentDate ?? row.createdAt;
            return at >= start && at <= end;
          })
          .reduce((sum, row) => sum + row.paidCents, 0) +
        sales
          .filter((row) => row.date >= start && row.date <= end)
          .reduce((sum, row) => sum + row.amountCents, 0);
      const monthExpenses = expenses
        .filter((row) => row.date >= start && row.date <= end)
        .reduce((sum, row) => sum + row.amountCents, 0);
      monthly.push({
        label: date.toLocaleString("en-US", { month: "short" }),
        revenue: monthRevenue,
        expenses: monthExpenses,
      });
    }

    /* last 30 days daily check-in counts for the attendance chart */
    const dailyCheckIns: { date: number; count: number }[] = [];
    for (let offset = 29; offset >= 0; offset -= 1) {
      const dayStart = todayStart - offset * DAY_MS;
      const dayEnd = dayStart + DAY_MS - 1;
      dailyCheckIns.push({
        date: dayStart,
        count: checkIns.filter((row) => row.at >= dayStart && row.at <= dayEnd)
          .length,
      });
    }

    const withdrawalsInRange = withdrawals.filter(
      (row) => row.date >= from && row.date <= to,
    );

    return {
      range: { from, to },
      kpis: {
        totalMembers: members.length,
        revenueCents,
        expenseCents,
        netProfitCents: revenueCents - expenseCents,
      },
      attendance,
      charts: {
        memberStatus: statusCounts,
        genderSplit: genderCounts,
        paymentMethods: [...methodTotals.entries()].map(([method, total]) => ({
          method,
          total,
        })),
        revenueBreakdown: Object.entries(revenueBreakdown)
          .filter(([, total]) => total > 0)
          .map(([label, total]) => ({ label, total })),
        expenseBreakdown: [...expenseTotals.entries()]
          .map(([category, total]) => ({ category, total }))
          .sort((a, b) => b.total - a.total),
        feeCollection: {
          collectedCents: rangeCollected,
          outstandingCents: Math.max(0, rangeTotals - rangeCollected),
          collectedCount: rangeFees.filter((row) => row.status === "paid").length,
          partialCount: rangeFees.filter((row) => row.status === "partial").length,
          pendingCount: rangeFees.filter((row) => row.status === "pending").length,
        },
        packagePopularity: [...packageCounts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        rushHour,
        monthly,
        dailyCheckIns,
      },
      withdrawals: {
        count: withdrawalsInRange.length,
        totalCents: withdrawalsInRange.reduce(
          (sum, row) => sum + row.amountCents,
          0,
        ),
      },
    };
  },
});
