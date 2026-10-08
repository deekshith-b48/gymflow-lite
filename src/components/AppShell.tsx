import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Package,
  Rss,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/dashboard/catalog", label: "Catalog", icon: Package, end: false },
      { to: "/dashboard/schedule", label: "Schedule", icon: CalendarClock, end: false },
      { to: "/dashboard/feed", label: "Feed", icon: Rss, end: false },
    ],
  },
  {
    label: "Front desk",
    items: [
      { to: "/dashboard/members", label: "Members", icon: Users, end: false },
      { to: "/dashboard/check-ins", label: "Check-ins", icon: ScanLine, end: false },
    ],
  },
  {
    label: "Control",
    items: [
      { to: "/dashboard/admin", label: "Admin", icon: ShieldCheck, end: false },
    ],
  },
];

const MOBILE_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/**
 * The workspace shell: a rail on desktop, a scrollable tab bar on phones. The
 * same seven surfaces are reachable at every size.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // A fresh workspace opens on empty screens, which reads as broken. Load the
  // sample roster plus catalog, sessions, orders and posts once — and never
  // again if the operator clears them out.
  const seedState = useQuery(api.seed.status);
  const seedRoster = useMutation(api.members.seedDemo);
  const seedWorkspace = useMutation(api.seed.workspace);
  const seedAttempted = useRef(false);

  useEffect(() => {
    if (!seedState || seedState.ready || seedAttempted.current) return;
    seedAttempted.current = true;
    Promise.all([seedRoster(), seedWorkspace()])
      .then(([roster, workspace]) => {
        if (roster.seeded || workspace.seeded) {
          toast("Sample workspace loaded", {
            description:
              "Members, catalog items, a week of sessions, orders and posts.",
          });
        }
      })
      .catch(() => {
        seedAttempted.current = false;
      });
  }, [seedState, seedRoster, seedWorkspace]);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

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

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center px-5">
          <Wordmark to="/dashboard" />
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="eyebrow px-3 pb-1">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
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
                          "size-4",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
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
        </div>
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

      <div className="md:pl-64">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10"
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
