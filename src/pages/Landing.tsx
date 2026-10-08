import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CreditCard,
  Gauge,
  Package,
  Rss,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router";

const MODULES = [
  {
    icon: Package,
    title: "Catalog",
    body: "Memberships, class packs, inductions and day passes, priced per cadence and published in one tap. Search and filters work the way your listing does.",
  },
  {
    icon: CalendarClock,
    title: "Schedule & booking",
    body: "Publish sessions with a coach, a room and a seat count. Live seat counts, one-tap booking and instant cancellation — no double bookings.",
  },
  {
    icon: CreditCard,
    title: "Checkout",
    body: "Turn any catalog item into an order. Card payments settle in the sandbox today, desk payments stay pending until your team collects them.",
  },
  {
    icon: Rss,
    title: "Feed & uploads",
    body: "Announcements, updates and internal notes with images uploaded straight to storage. Draft first, publish when you are ready.",
  },
  {
    icon: ScanLine,
    title: "Roster & check-ins",
    body: "The front desk you already trust: the member list, one-tap visits, plans and dues that never hide behind a second screen.",
  },
  {
    icon: ShieldCheck,
    title: "Admin area",
    body: "Revenue, orders, moderation and management for everything you sell and schedule, with every action auditable from one place.",
  },
];

const INCLUDED = [
  "Sign up and log in",
  "Browse and search the catalog",
  "Open a detail page for any item",
  "Book or schedule a time",
  "Pay or check out",
  "Post and upload your own content",
  "See your own dashboard",
  "Manage everything from the admin area",
];

const FLOW_SNIPPET = `// every surface is a live query
const schedule = useQuery(api.sessions.list, {});

// seats update the moment someone books
const book = useMutation(api.sessions.book);`;

/**
 * GymNetic's landing page, aimed at the businesses that run gyms — owners,
 * operators and the developers who wire up their stack.
 */
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const workspaceHref = isAuthenticated
    ? "/dashboard"
    : "/auth?returnTo=/dashboard";
  const workspaceLabel = isAuthenticated
    ? "Open your workspace"
    : "Create your workspace";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-8 lg:flex">
            <a
              href="#platform"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Platform
            </a>
            <a
              href="#developers"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Developers
            </a>
            <a
              href="#included"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              What&apos;s included
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button
                asChild
                variant="ghost"
                className="hidden sm:inline-flex"
              >
                <Link to="/auth?returnTo=/dashboard">Sign in</Link>
              </Button>
            )}
            <Button asChild>
              <Link to={workspaceHref}>
                {workspaceLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 15% 0%, oklch(0.63 0.225 296 / 0.35), transparent 70%), radial-gradient(45% 55% at 85% 10%, oklch(0.8 0.128 205 / 0.28), transparent 70%), radial-gradient(40% 50% at 60% 60%, oklch(0.87 0.196 129 / 0.14), transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(to right, oklch(1 0 0 / 5%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 5%) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(80% 70% at 50% 0%, black, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(80% 70% at 50% 0%, black, transparent 75%)",
            }}
          />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1">
                <span className="size-1.5 rounded-full bg-primary" />
                <span className="figure text-[10.5px] text-muted-foreground">
                  Built for the businesses that run gyms
                </span>
              </span>

              <h1 className="mt-6 text-[2.7rem] font-bold leading-[1.03] tracking-tight sm:text-6xl">
                The operating system
                <br />
                for{" "}
                <span className="bg-gradient-to-r from-primary via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                  modern gyms
                </span>
                .
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                GymNetic gives gym businesses one place to sell memberships,
                schedule sessions, take payments, publish updates and look after
                every member — running on a reactive backend, so nothing on
                screen is ever a stale copy of the truth.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to={workspaceHref}>
                    {workspaceLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="shadow-none"
                >
                  <a href="#platform">Tour the platform</a>
                </Button>
              </div>

              <ul className="figure mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
                <li>Real-time data</li>
                <li className="text-border">/</li>
                <li>No sync jobs</li>
                <li className="text-border">/</li>
                <li>File storage included</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
              className="mx-auto w-full max-w-md"
            >
              <WorkspacePreview />
            </motion.div>
          </div>
        </section>

        <section id="platform" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
            >
              <p className="eyebrow">The platform</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Six modules, one workspace.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Each one is useful on its own and better together: the catalog
                feeds the schedule, the schedule feeds the bookings, and every
                order lands in the admin area.
              </p>
            </motion.div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((module, index) => (
                <motion.article
                  key={module.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="group bg-card p-6 transition-colors hover:bg-accent/60"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-secondary text-primary">
                    <module.icon className="size-4" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {module.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {module.body}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="developers" className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="eyebrow">For developers</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Reactive by default.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground">
                GymNetic runs on Convex. Queries are subscriptions, mutations are
                transactions and file storage is built in, so a booking taken at
                the desk appears on every screen without a refresh, a webhook or
                a cache to invalidate.
              </p>

              <ul className="mt-8 flex flex-col gap-4">
                {[
                  "Typed end to end — the same schema backs every screen.",
                  "Mutations are atomic, so orders and seats never half-update.",
                  "Uploads go straight to storage; posts keep only the id.",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="size-2 rounded-full bg-rose-400/70" />
                <span className="size-2 rounded-full bg-amber-400/70" />
                <span className="size-2 rounded-full bg-lime-400/70" />
                <span className="figure ml-2 text-[10.5px] text-muted-foreground">
                  workspace/catalog-item.tsx
                </span>
              </div>
              <pre className="overflow-x-auto px-4 py-5 font-mono text-[11.5px] leading-6 text-muted-foreground">
                <code>{FLOW_SNIPPET}</code>
              </pre>
              <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
                <CodeStat label="Tables" value="9" />
                <CodeStat label="Modules" value="6" />
                <CodeStat label="Latency" value="live" />
              </div>
            </div>
          </div>
        </section>

        <section id="included" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className="eyebrow">Everything in this release</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              No roadmap promises — it is all shipped.
            </h2>

            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {INCLUDED.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, x: -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="flex items-center gap-3 bg-card px-5 py-4 text-sm"
                >
                  <span className="flex size-6 items-center justify-center rounded-md border border-primary/40 bg-primary/10">
                    <Check className="size-3.5 text-primary" />
                  </span>
                  {item}
                </motion.div>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-xs leading-5 text-muted-foreground">
              Payment card processing and per-staff roles are the next two
              additions; today checkouts settle in the sandbox or stay pending
              for the desk to collect, and every operator in a workspace has
              full admin rights.
            </p>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-20 text-center sm:px-8">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(45% 60% at 50% 100%, oklch(0.63 0.225 296 / 0.28), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Futurise the way your gym is run.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                Create a workspace, drop in your catalog and schedule, and press
                publish. The sample data is already there so you can see the
                whole loop working first.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to={workspaceHref}>
                    {workspaceLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="shadow-none"
                >
                  <Link to="/dashboard/members">See the front desk</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <p className="figure text-[11px] text-muted-foreground">
            Catalog · Schedule · Checkout · Feed · Members · Admin
          </p>
        </div>
      </footer>
    </div>
  );
}

function CodeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="figure mt-1 text-sm">{value}</p>
    </div>
  );
}

/** A miniature of the workspace — the numbers, an item and a booking. */
function WorkspacePreview() {
  const tiles = [
    { label: "Revenue today", value: "$1,240", tone: "text-primary" },
    { label: "Active members", value: "248", tone: "" },
    { label: "In today", value: "61", tone: "" },
    { label: "Seats open", value: "18", tone: "text-cyan-300" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-none backdrop-blur">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="eyebrow">Workspace</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          <span className="figure text-[10px] text-muted-foreground">live</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-card px-4 py-3">
            <p className="eyebrow">{tile.label}</p>
            <p className={cn("figure mt-1 text-lg font-medium", tile.tone)}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-violet-200">
            Memberships
          </span>
          <span className="figure text-sm">$79/mo</span>
        </div>
        <p className="mt-3 text-sm font-semibold tracking-tight">
          Unlimited membership
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          All sessions, 24/7 access, one guest pass a month.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
            <CreditCard className="size-3" />
            Pay now
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            <CalendarClock className="size-3" />
            Book 06:30 · 4 left
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Gauge className="size-3.5 text-primary" />
        <span className="figure text-[10.5px] text-muted-foreground">
          order GN-4F2A9C · paid · 12s ago
        </span>
      </div>
    </div>
  );
}
