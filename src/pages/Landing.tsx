import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, Check, LogIn, Minus } from "lucide-react";
import { Link } from "react-router";

const FEATURES = [
  {
    index: "01",
    title: "Member list",
    body: "Every member on one line: plan, dues state and the last time they trained. Search by name, email or phone and filter down to who is active.",
  },
  {
    index: "02",
    title: "One-tap check-ins",
    body: "Tap a name at the desk and the visit is logged. Today's log and the last seven days sit next to it, so a shift reads at a glance.",
  },
  {
    index: "03",
    title: "Plan & dues",
    body: "The member's own screen leads with the plan and what is owed. Collect at the desk, mark it paid, and the cycle rolls on.",
  },
];

const IN_SCOPE = [
  "Admin sign-in",
  "Member list & search",
  "One-tap check-ins",
  "Plan & dues tracking",
];

const OUT_OF_SCOPE = [
  "Member logins",
  "Class scheduling",
  "Online payments",
  "Trainer profiles",
];

/**
 * The landing page is deliberately quiet: paper, ink, hairline rules and one
 * preview of the actual desk. No gradients competing with the product.
 */
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const deskHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard";
  const deskLabel = isAuthenticated ? "Open the desk" : "Get started";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#inside"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              What&apos;s inside
            </a>
            <a
              href="#shift"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              The shift
            </a>
            <a
              href="#scope"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Version 1
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/auth?returnTo=/dashboard">Sign in</Link>
              </Button>
            )}
            <Button asChild>
              <Link to={deskHref}>
                {deskLabel}
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
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
              backgroundSize: "22px 22px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent 75%)",
            }}
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <p className="eyebrow">Gym operations · Version 1</p>
              <h1 className="mt-5 text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
                Run the floor,
                <br />
                not the spreadsheet.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground">
                Rack is the front desk for independent gyms: one member list,
                check-ins in a single tap, and plans and dues that never hide.
                Built for the person standing at the counter.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to={deskHref}>
                    {deskLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="shadow-none">
                  <a href="#inside">See what&apos;s inside</a>
                </Button>
              </div>
              <p className="figure mt-6 text-[11px] text-muted-foreground">
                Admins only in version 1 · member access comes later
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: "easeOut" }}
              className="mx-auto w-full max-w-sm"
            >
              <DeskPreview />
            </motion.div>
          </div>
        </section>

        <section id="inside" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
            >
              <p className="eyebrow">What&apos;s inside</p>
              <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Three jobs, done properly.
              </h2>
            </motion.div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <motion.div
                  key={feature.index}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="bg-card p-6"
                >
                  <span className="figure text-xs text-muted-foreground">
                    {feature.index}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="shift" className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.85fr_1fr] lg:py-20">
            <div>
              <p className="eyebrow">The shift</p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Six seconds per person.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">
                The app assumes someone is mid-conversation with a member. Every
                screen is one decision wide, and nothing important is more than
                a tap away.
              </p>
            </div>
            <ol className="flex flex-col">
              {[
                "Sign in at the desk — staff only in version 1.",
                "Find the member by name, and tap to log the visit.",
                "Settle dues from the member's own screen when they pay.",
              ].map((step, index) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="flex items-start gap-5 border-b border-border py-5 first:border-t first:border-border"
                >
                  <span className="figure mt-0.5 text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-6">{step}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section id="scope" className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className="eyebrow">Version 1, stated plainly</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              A small, finished first release.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              <div className="bg-card p-6">
                <p className="eyebrow">In this version</p>
                <ul className="mt-5 flex flex-col gap-3">
                  {IN_SCOPE.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <Check className="size-4 text-foreground" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card p-6">
                <p className="eyebrow">Not yet — deliberately</p>
                <ul className="mt-5 flex flex-col gap-3">
                  {OUT_OF_SCOPE.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-sm text-muted-foreground"
                    >
                      <Minus className="size-4" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-20 text-center sm:px-8">
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
              The desk is open.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Sign in with your email and start with the roster. The sample
              members are already there so you can see a full week of visits.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to={deskHref}>
                {deskLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Wordmark />
          <p className="figure text-[11px] text-muted-foreground">
            Member list · Check-ins · Plan &amp; dues
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * A miniature of the real app — the roster above, the member's plan & dues
 * below — so the hero shows the product instead of describing it.
 */
function DeskPreview() {
  const rows = [
    { initials: "AO", name: "Amara Osei", meta: "Annual · renews in 122d", chip: "Settled", in: true },
    { initials: "BN", name: "Ben Nakamura", meta: "Monthly · lapsed 5d ago", chip: "$49", in: false, alert: true },
    { initials: "DR", name: "Dev Ramachandran", meta: "Monthly · renews in 3d", chip: "$49", in: false },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="eyebrow">Roster</span>
        <span className="figure text-[10.5px] text-muted-foreground">
          8 members · 3 in
        </span>
      </div>

      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10.5px]">
              {row.initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {row.name}
              </span>
              <span className="figure mt-0.5 block text-[10.5px] text-muted-foreground">
                {row.meta}
              </span>
            </span>
            {row.in ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-600/25 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-600" />
                IN
              </span>
            ) : (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                  row.alert
                    ? "border-rose-600/30 bg-rose-50 text-rose-700"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {row.chip}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-border bg-secondary/40 px-4 py-4">
        <span className="eyebrow">My plan &amp; dues</span>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-base font-semibold tracking-tight">Monthly</p>
            <p className="figure mt-0.5 text-[10.5px] text-muted-foreground">
              $49 / 30d · renews in 3d
            </p>
          </div>
          <p className="figure text-2xl font-medium">$49</p>
        </div>
        <div className="mt-4 h-px w-full bg-border">
          <div className="h-px w-[62%] bg-foreground" />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="figure text-[10.5px] text-muted-foreground">
            Due in 3d
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
            <LogIn className="size-3" />
            Mark dues paid
          </span>
        </div>
      </div>
    </div>
  );
}
