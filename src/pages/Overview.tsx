import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  categoryTone,
  formatMoney,
  formatRecency,
  formatTime,
  orderStatusClass,
  postKindLabel,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CalendarClock,
  Loader2,
  Package,
  Rss,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router";

const SHORTCUTS = [
  { to: "/dashboard/catalog", label: "Catalog", icon: Package, hint: "Items, pricing, stock" },
  { to: "/dashboard/schedule", label: "Schedule", icon: CalendarClock, hint: "Sessions and bookings" },
  { to: "/dashboard/feed", label: "Feed", icon: Rss, hint: "Announcements and uploads" },
  { to: "/dashboard/members", label: "Members", icon: Users, hint: "Roster, plans, dues" },
  { to: "/dashboard/check-ins", label: "Check-ins", icon: ScanLine, hint: "Front-desk log" },
  { to: "/dashboard/admin", label: "Admin", icon: ShieldCheck, hint: "Orders and moderation" },
];

/**
 * The operator's own dashboard: live numbers for the gym, the next session,
 * what has sold, and one tap to every other surface.
 */
export default function Overview() {
  const { user } = useAuth();
  const summary = useQuery(api.overview.summary);

  if (!summary) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tiles = [
    {
      label: "Revenue today",
      value: formatMoney(summary.revenue.todayCents),
      hint: `${summary.revenue.paidCount} paid orders all time`,
    },
    {
      label: "Revenue 30d",
      value: formatMoney(summary.revenue.revenue30dCents),
      hint: `${formatMoney(summary.revenue.pendingCents)} awaiting collection`,
    },
    {
      label: "Active members",
      value: String(summary.roster.active),
      hint: `${summary.roster.total} on the roster`,
    },
    {
      label: "In today",
      value: String(summary.roster.checkedInToday),
      hint: "Check-ins logged since midnight",
    },
    {
      label: "Upcoming sessions",
      value: String(summary.schedule.upcoming),
      hint: `${summary.schedule.myBookings} booked by you`,
    },
    {
      label: "Catalog live",
      value: `${summary.catalog.published}/${summary.catalog.total}`,
      hint: `${formatMoney(summary.catalog.averagePriceCents)} average price`,
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="eyebrow">Workspace</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Everything below is live — your catalog, sessions, check-ins and
          revenue, updating as your team works the floor.
        </p>
      </header>

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile, index) => (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
            className="bg-card px-5 py-4"
          >
            <p className="eyebrow">{tile.label}</p>
            <p className="figure mt-2 text-2xl font-medium">{tile.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="eyebrow">Next session</p>
            <Link
              to="/dashboard/schedule"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Schedule
            </Link>
          </div>
          {summary.schedule.nextSession ? (
            <div className="px-5 py-5">
              <p className="text-lg font-semibold tracking-tight">
                {summary.schedule.nextSession.title}
              </p>
              <p className="figure mt-1 text-xs text-muted-foreground">
                {formatTime(summary.schedule.nextSession.startsAt)} ·{" "}
                {summary.schedule.nextSession.coach} ·{" "}
                {summary.schedule.nextSession.room}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {summary.schedule.nextSession.capacity} seats configured
              </p>
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Nothing scheduled yet. Add a session from the schedule.
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="eyebrow">Recent orders</p>
            <Link
              to="/dashboard/admin"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Admin
            </Link>
          </div>
          {summary.revenue.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              No checkouts yet. Sell something from the catalog to see it here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.revenue.recentOrders.map((order) => (
                <li
                  key={order._id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {order.itemName}
                    </span>
                    <span className="figure mt-0.5 block text-[11px] text-muted-foreground">
                      {order.reference} · {formatRecency(order.createdAt)}
                    </span>
                  </span>
                  <span className="figure text-sm">
                    {formatMoney(order.amountCents)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                      orderStatusClass(order.status),
                    )}
                  >
                    {order.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {summary.content.latest && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="eyebrow">Latest from the feed</p>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                summary.content.latest.published
                  ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {summary.content.latest.published ? "published" : "draft"}
            </span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm font-medium">
              {summary.content.latest.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {postKindLabel(summary.content.latest.kind)} ·{" "}
              {summary.content.latest.authorName} ·{" "}
              {formatRecency(summary.content.latest.createdAt)}
            </p>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="eyebrow">Jump to</p>
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className="group flex items-center gap-3 bg-card px-5 py-4 transition-colors hover:bg-accent"
            >
              <span className={cn("rounded-md border p-2", categoryTone(shortcut.label))}>
                <shortcut.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {shortcut.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {shortcut.hint}
                </span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        {summary.catalog.published} items live · {summary.content.published}{" "}
        posts published ·{" "}
        <Link
          to="/dashboard/catalog"
          className="underline underline-offset-4 hover:text-foreground"
        >
          manage the catalog
        </Link>
      </p>
    </div>
  );
}
