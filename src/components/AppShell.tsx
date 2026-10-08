import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { applyAccent, applyMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  Bell,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Dumbbell,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PackagePlus,
  Receipt,
  Rss,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Front desk",
    items: [
      { to: "/dashboard/members", label: "Members", icon: Users, end: false },
      { to: "/dashboard/attendance", label: "Attendance", icon: ScanLine, end: false },
      { to: "/dashboard/fees", label: "Fees", icon: Receipt, end: false },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/dashboard/sales", label: "Sales", icon: ShoppingCart, end: false },
      { to: "/dashboard/expenses", label: "Expenses", icon: Wallet, end: false },
      { to: "/dashboard/withdrawals", label: "Withdrawals", icon: BadgeDollarSign, end: false },
    ],
  },
  {
    label: "Team & catalog",
    items: [
      { to: "/dashboard/staff", label: "Users & Staff", icon: UserCog, end: false },
      { to: "/dashboard/packages", label: "Packages", icon: Package, end: false },
      { to: "/dashboard/trainers", label: "Trainers", icon: Dumbbell, end: false },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/dashboard/notifications", label: "Notifications", icon: Bell, end: false },
      { to: "/dashboard/activity", label: "Activity Log", icon: History, end: false },
      { to: "/dashboard/settings", label: "Settings", icon: Settings, end: false },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/dashboard/catalog", label: "Catalog", icon: PackagePlus, end: false },
      { to: "/dashboard/schedule", label: "Schedule", icon: CalendarClock, end: false },
      { to: "/dashboard/feed", label: "Feed", icon: Megaphone, end: false },
      { to: "/dashboard/check-ins", label: "Check-ins", icon: Rss, end: false },
      { to: "/dashboard/admin", label: "Admin", icon: ShieldCheck, end: false },
    ],
  },
] as const;

// The phone tab bar can only fit the six surfaces staff reach for most.
const MOBILE_ITEMS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/dashboard/members", label: "Members", icon: Users, end: false },
  { to: "/dashboard/attendance", label: "Visit", icon: ScanLine, end: false },
  { to: "/dashboard/fees", label: "Fees", icon: CreditCard, end: false },
  { to: "/dashboard/sales", label: "Sales", icon: ShoppingCart, end: false },
  { to: "/dashboard/settings", label: "More", icon: Settings, end: false },
] as const;

const COLLAPSE_KEY = "gymnetic.sidebar.collapsed";

/**
 * The workspace shell: a rail on desktop, a scrollable tab bar on phones. The
 * sidebar collapses to icon-only mode for more screen space — the choice is
 * remembered across reloads.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // A fresh workspace opens on empty screens, which reads as broken. Load the
  // sample roster plus catalog, sessions, orders and posts once — and never
  // again if the operator clears them out.
  const seedState = useQuery(api.seed.status);
  const settings = useQuery(api.settings.get, {});
  const seedRoster = useMutation(api.members.seedDemo);
  const seedWorkspace = useMutation(api.seed.workspace);
  const seedFinance = useMutation(api.seedFinance.finance);
  const seedAttempted = useRef(false);

  // Apply the saved accent colour and default mode as soon as settings land,
  // so the whole workspace opens already themed.
  useEffect(() => {
    if (!settings) return;
    applyAccent(settings.accentColor);
    applyMode(settings.defaultMode);
  }, [settings]);

  useEffect(() => {
    if (!seedState || seedState.ready || seedAttempted.current) return;
    seedAttempted.current = true;
    Promise.all([seedRoster(), seedWorkspace()])
      .then(async ([roster, workspace]) => {
        // The finance seed needs the roster to exist, so it runs right after.
        const finance = await seedFinance();
        if (roster.seeded || workspace.seeded || finance.seeded) {
          toast("Sample workspace loaded", {
            description:
              "Members, packages, fees, sales, expenses and 90 days of visits.",
          });
        }
      })
      .catch(() => {
        seedAttempted.current = false;
      });
  }, [seedState, seedRoster, seedWorkspace, seedFinance]);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const railWidth = collapsed ? "md:w-[68px]" : "md:w-64";
  const contentPad = collapsed ? "md:pl-[68px]" : "md:pl-64";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64 opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 20% 0%, oklch(0.63 0.225 296 / 0.22), transparent 70%), radial-gradient(50% 100% at 85% 0%, oklch(0.8 0.128 205 / 0.16), transparent 70%)",
        }}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
          railWidth,
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          {collapsed ? (
            <span className="flex size-8 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground">
              GN
            </span>
          ) : (
            <Wordmark to="/dashboard" />
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && <p className="eyebrow px-3 pb-1">{group.label}</p>}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0 py-2.5",
                      isActive
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!collapsed && item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <>
              <p className="eyebrow px-2 pb-2">Signed in</p>
              <p className="truncate px-2 pb-3 font-mono text-xs text-muted-foreground">
                {user?.email ?? "operator"}
              </p>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 shadow-none"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <>
              <ChevronLeft className="size-4" />
              Collapse
            </>
          )}
        </button>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
        <Wordmark to="/dashboard" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
        </Button>
      </header>

      <div className={contentPad}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10"
        >
          <Outlet />
        </motion.main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-border bg-background/95 px-2 py-1.5 backdrop-blur md:hidden">
        {MOBILE_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[10.5px] transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "size-[18px]",
                    isActive && "text-primary",
                  )}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
