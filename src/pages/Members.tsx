import { MemberFormDialog } from "@/components/MemberFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import {
  duesBadgeClass,
  formatMoney,
  formatRenewal,
  formatVisit,
  initials,
  MEMBER_STATUS_OPTIONS,
  startOfDay,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Loader2, LogIn, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  ...MEMBER_STATUS_OPTIONS,
];

/**
 * The roster — the desk's home screen and the first thing version 1 needed.
 * Members, their plan, their dues state and when they last trained, one line
 * each, with check-in reachable without opening the member.
 */
export default function Members() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [dayStart] = useState(() => startOfDay(Date.now()));

  const roster = useQuery(api.members.list, { search, status });
  const today = useQuery(api.checkIns.today, { since: dayStart });

  const checkedInToday = new Set(
    (today?.items ?? []).map((item) => String(item.memberId)),
  );

  const stats = roster?.stats;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Roster</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats
              ? `${stats.active} active · ${stats.overdue} behind on dues`
              : "Loading the roster…"}
          </p>
        </div>
        <Button className="self-start" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add member
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        <Stat label="Members" value={stats ? String(stats.total) : "—"} />
        <Stat label="Active" value={stats ? String(stats.active) : "—"} />
        <Stat
          label="In today"
          value={today ? String(today.uniqueMembers) : "—"}
        />
        <Stat
          label="Dues owed"
          value={stats ? formatMoney(stats.duesOutstandingCents) : "—"}
          tone={stats && stats.overdue > 0 ? "alert" : "default"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone"
            className="pl-9 shadow-none"
            autoComplete="off"
          />
        </div>
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(value) => value && setStatus(value)}
          variant="outline"
          size="sm"
          className="w-full justify-start sm:w-auto"
        >
          {STATUS_FILTERS.map((filter) => (
            <ToggleGroupItem
              key={filter.value}
              value={filter.value}
              className="flex-1 sm:flex-none"
            >
              {filter.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {roster === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : roster.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm font-medium">No members here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {search || status !== "all"
              ? "Nothing matches that filter. Try a broader search."
              : "Add the first member and the roster, dues and check-in log start filling in."}
          </p>
          <Button className="mt-5" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {roster.items.map((member) => {
            const isIn = checkedInToday.has(String(member._id));
            return (
              <li
                key={member._id}
                className="flex items-center gap-3 py-2.5 pl-3 pr-3 transition-colors hover:bg-accent/50"
              >
                <Link
                  to={`/dashboard/members/${member._id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[11px] font-medium tracking-tight">
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {member.name}
                      </span>
                      {member.status !== "active" && (
                        <span className="eyebrow">{member.status}</span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{member.planLabel}</span>
                      <span aria-hidden>·</span>
                      <span className="figure">
                        {formatRenewal(member.renewsAt)}
                      </span>
                    </span>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-right sm:block">
                    <span className="eyebrow block">Last visit</span>
                    <span className="figure text-xs text-muted-foreground">
                      {formatVisit(member.lastCheckInAt)}
                    </span>
                  </span>

                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-wide",
                      duesBadgeClass(member.dues.state),
                    )}
                  >
                    {member.duesAmountCents > 0
                      ? formatMoney(member.duesAmountCents)
                      : member.dues.label}
                  </span>

                  {isIn ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10.5px] text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      IN
                    </span>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="shadow-none"
                    >
                      <Link to={`/dashboard/check-ins?member=${member._id}`}>
                        <LogIn className="size-3.5" />
                        <span className="hidden sm:inline">Check in</span>
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <MemberFormDialog
        open={adding}
        onOpenChange={setAdding}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "alert";
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "figure mt-1 text-xl font-medium",
          tone === "alert" && "text-rose-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}
