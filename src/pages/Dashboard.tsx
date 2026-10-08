import { DateRangeFilter } from "@/components/workspace/DateRangeFilter";
import {
  DonutChart,
  HorizontalBars,
  MultiLineChart,
  VerticalBars,
} from "@/components/workspace/charts";
import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  Stat,
  StatGrid,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  formatMoney,
  resolveDateRange,
  type DateRangePreset,
} from "@/lib/gym";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank Transfer",
  card: "Card",
  online: "Online",
};

const METHOD_TONES: Record<string, string> = {
  cash: "var(--chart-1)",
  bank: "var(--chart-2)",
  card: "var(--chart-3)",
  online: "var(--chart-4)",
};

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * The dashboard: four KPI tiles, the attendance summary and a date-range
 * filter that drives every chart below — all from one reactive query, so a
 * check-in at the desk redraws the page without a refresh.
 */
export default function Dashboard() {
  const [preset, setPreset] = useState<DateRangePreset>("thisMonth");
  const [range, setRange] = useState(() => resolveDateRange("thisMonth"));

  const data = useQuery(api.finance.dashboard, { from: range.from, to: range.to });

  if (data === undefined) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          lede="Revenue, attendance and the health of the gym at a glance."
        />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const { kpis, attendance, charts } = data;
  const membersTotal = Object.values(charts.memberStatus).reduce(
    (sum, count) => sum + count,
    0,
  );
  const statusTotal = Math.max(membersTotal, 1);
  const genderTotal = Math.max(
    charts.genderSplit.male + charts.genderSplit.female,
    1,
  );
  const methodTotal = charts.paymentMethods.reduce(
    (sum, entry) => sum + entry.total,
    0,
  );
  const revenueTotal = charts.revenueBreakdown.reduce(
    (sum, entry) => sum + entry.total,
    0,
  );
  const collection = charts.feeCollection;
  const collectionTotal =
    collection.collectedCents + collection.outstandingCents;
  const peakRush = Math.max(...charts.rushHour.map((entry) => entry.total), 0);

  const isEmpty =
    kpis.totalMembers === 0 &&
    kpis.revenueCents === 0 &&
    attendance.allTime === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-7">
        <PageHeader
          eyebrow="Overview"
          title="Dashboard"
          lede="Revenue, attendance and the health of the gym at a glance."
        />
        <EmptyState
          title="The dashboard wakes up with your first data"
          body="Add a member, record a fee or log a check-in and every tile and chart below fills itself in."
          action={
            <Button asChild>
              <Link to="/dashboard/members">Open the roster</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        lede="Revenue, attendance and the health of the gym at a glance."
        actions={
          <Button asChild variant="outline" className="shadow-none">
            <Link to="/dashboard/activity">View activity log</Link>
          </Button>
        }
      />

      <DateRangeFilter
        preset={preset}
        onPresetChange={setPreset}
        range={range}
        onRangeChange={setRange}
      />

      {/* KPI row */}
      <StatGrid>
        <Stat
          label="Total Members"
          value={String(kpis.totalMembers)}
          hint={`${charts.memberStatus.active} active right now`}
        />
        <Stat
          label="Revenue"
          value={formatMoney(kpis.revenueCents)}
          hint="Fees + sales in range"
          tone="good"
        />
        <Stat
          label="Expenses"
          value={formatMoney(kpis.expenseCents)}
          hint="All recorded in range"
        />
        <Stat
          label="Net Profit"
          value={formatMoney(kpis.netProfitCents)}
          hint="Revenue minus expenses"
          tone={kpis.netProfitCents < 0 ? "alert" : "good"}
        />
      </StatGrid>

      {/* Attendance summary */}
      <StatGrid>
        <Stat
          label="Attendance · Today"
          value={String(attendance.today)}
          hint="Check-ins since midnight"
        />
        <Stat
          label="Attendance · This Month"
          value={String(attendance.thisMonth)}
          hint="Since the 1st"
        />
        <Stat
          label="Attendance · All Time"
          value={String(attendance.allTime)}
          hint="Every logged visit"
        />
        <Stat
          label="Withdrawn"
          value={formatMoney(data.withdrawals.totalCents)}
          hint={`${data.withdrawals.count} draw${data.withdrawals.count === 1 ? "" : "s"} in range`}
        />
      </StatGrid>

      {/* Chart grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Member Status">
          <DonutChart
            centerLabel="Members"
            centerValue={String(membersTotal)}
            format="count"
            data={[
              { label: "Active", value: charts.memberStatus.active, tone: "var(--chart-1)" },
              { label: "Inactive", value: charts.memberStatus.inactive, tone: "var(--chart-3)" },
              { label: "Expired", value: charts.memberStatus.expired, tone: "var(--chart-5)" },
              { label: "Frozen", value: charts.memberStatus.frozen, tone: "var(--chart-2)" },
            ]}
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Active {percent(charts.memberStatus.active, statusTotal)}% · Expired{" "}
            {percent(charts.memberStatus.expired, statusTotal)}%
          </p>
        </Panel>

        <Panel title="Gender Split">
          <DonutChart
            centerLabel="Members"
            centerValue={String(genderTotal - 0)}
            format="count"
            data={[
              { label: "Male", value: charts.genderSplit.male, tone: "var(--chart-2)" },
              { label: "Female", value: charts.genderSplit.female, tone: "var(--chart-4)" },
            ]}
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Male {percent(charts.genderSplit.male, genderTotal)}% · Female{" "}
            {percent(charts.genderSplit.female, genderTotal)}%
          </p>
        </Panel>

        <Panel title="Payment Methods">
          <DonutChart
            centerLabel="Collected"
            data={charts.paymentMethods.map((entry) => ({
              label: METHOD_LABELS[entry.method] ?? entry.method,
              value: entry.total,
              tone: METHOD_TONES[entry.method],
            }))}
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {charts.paymentMethods
              .map(
                (entry) =>
                  `${METHOD_LABELS[entry.method] ?? entry.method} ${percent(entry.total, methodTotal)}%`,
              )
              .join(" · ")}
          </p>
        </Panel>

        <Panel title="Revenue Breakdown">
          <DonutChart
            centerLabel="Revenue"
            data={charts.revenueBreakdown.map((entry) => ({
              label: entry.label,
              value: entry.total,
            }))}
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            {charts.revenueBreakdown
              .map((entry) => `${entry.label} ${percent(entry.total, revenueTotal)}%`)
              .join(" · ")}
          </p>
        </Panel>

        <Panel title="Expenses Breakdown">
          {charts.expenseBreakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No expenses in this range.
            </p>
          ) : (
            <HorizontalBars
              data={charts.expenseBreakdown.map((entry) => ({
                label: entry.category,
                value: entry.total,
              }))}
            />
          )}
        </Panel>

        <Panel title="Fee Collection">
          <DonutChart
            centerLabel="Collected"
            centerValue={`${percent(collection.collectedCents, collectionTotal)}%`}
            data={[
              { label: "Collected", value: collection.collectedCents, tone: "var(--chart-1)" },
              {
                label: "Outstanding",
                value: collection.outstandingCents,
                tone: "var(--chart-5)",
              },
            ]}
          />
          <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
            <span>
              Paid <span className="figure text-foreground">{collection.collectedCount}</span>
            </span>
            <span>
              Partial{" "}
              <span className="figure text-foreground">{collection.partialCount}</span>
            </span>
            <span>
              Pending{" "}
              <span className="figure text-foreground">{collection.pendingCount}</span>
            </span>
          </div>
        </Panel>

        <Panel title="Package Popularity">
          {charts.packagePopularity.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No members on a package yet.
            </p>
          ) : (
            <HorizontalBars
              format="count"
              data={charts.packagePopularity.map((entry) => ({
                label: entry.name,
                value: entry.count,
              }))}
            />
          )}
        </Panel>

        <Panel title="Rush Hour">
          <VerticalBars
            highlightPeak
            data={charts.rushHour.map((entry) => ({
              label: `${entry.hour}`,
              value: entry.total,
            }))}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Average check-ins per hour — peak {peakRush} visits
          </p>
        </Panel>

        <Panel title="Revenue vs Expenses" className="lg:col-span-2">
          <MultiLineChart
            data={charts.monthly.map((entry) => ({
              label: entry.label,
              revenue: Math.round(entry.revenue / 100),
              expenses: Math.round(entry.expenses / 100),
            }))}
            series={[
              { key: "revenue", name: "Revenue (Rs)", color: "var(--chart-1)" },
              { key: "expenses", name: "Expenses (Rs)", color: "var(--chart-5)" },
            ]}
          />
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Last six months, in rupees
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card ${className ?? ""}`}
    >
      <div className="border-b border-border px-5 py-3">
        <p className="eyebrow">{title}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
