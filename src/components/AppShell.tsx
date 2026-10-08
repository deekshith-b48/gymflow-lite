import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { CalendarCheck, LogOut, Users } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Members", icon: Users, end: true },
  { to: "/dashboard/check-ins", label: "Check-ins", icon: CalendarCheck, end: false },
];

/**
 * The desk shell. On phones it is an app frame — sticky header, bottom tab bar
 * and a single content column. From `md` up the same navigation moves into a
 * fixed left rail so wide screens are not a stretched phone.
 */
export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center px-5">
          <Wordmark to="/dashboard" />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <p className="eyebrow px-3 pb-2 pt-4">Desk</p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <p className="eyebrow px-2 pb-2">Signed in</p>
          <p className="truncate px-2 pb-3 font-mono text-xs text-muted-foreground">
            {user?.email ?? "staff"}
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

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
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

      <div className="md:pl-60">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 sm:px-8 md:pb-16 md:pt-10"
        >
          <Outlet />
        </motion.main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 py-3 text-[11px] transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
