import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  addDays,
  formatRenewal,
  formatTime,
  initials,
  startOfDay,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Check, Loader2, LogIn, Search, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

const DAY_MS = 86_400_000;

/**
 * Check-ins: the second half of what the desk does all day. Tap a name and the
 * visit is logged; the day's log and the last week give the shift its shape.
 */
export default function CheckIns() {
  const [now] = useState(() => Date.now());
  const dayStart = useMemo(() => startOfDay(now), [now]);
  const weekStart = useMemo(() => addDays(dayStart, -6), [dayStart]);

  const [searchParams, setSearchParams] = useSearchParams();
  const stagedId = searchParams.get("member");

  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = useQuery(api.checkIns.today, { since: dayStart });
  const activity = useQuery(api.checkIns.activity, { since: weekStart });
  const results = useQuery(api.members.list, {
    search,
    status: "active",
  });
  const staged = useQuery(
    api.members.get,
    stagedId ? { memberId: stagedId as Id<"members"> } : "skip",
  );

  const checkIn = useMutation(api.checkIns.checkIn);
  const undoCheckIn = useMutation(api.checkIns.undo);

  const checkedInToday = new Set(
    (today?.items ?? []).map((item) => String(item.memberId)),
  );

  async function handleCheckIn(memberId: Id<"members">, name: string) {
    setBusyId(memberId);
    try {
      const result = await checkIn({ memberId });
      if (result.duplicate) {
        toast(`${name} was just checked in`, {
          description: `Logged at ${formatTime(result.at)}.`,
        });
      } else {
        toast.success(`${name} checked in`, {
          description: formatTime(result.at),
        });
      }
      if (stagedId === memberId) setSearchParams({}, { replace: true });
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not check in.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(checkInId: Id<"checkIns">, name: string) {
    try {
      await undoCheckIn({ checkInId });
      toast(`Visit removed`, { description: `${name}'s check-in was undone.` });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not undo.");
    }
  }

  const days = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, index) => ({
      dayStart: addDays(weekStart, index),
      count: 0,
    }));
    for (const at of activity ?? []) {
      const index = Math.round((startOfDay(at) - weekStart) / DAY_MS);
      if (index >= 0 && index < buckets.length) buckets[index].count += 1;
    }
    return buckets;
  }, [activity, weekStart]);

  const busiest = Math.max(1, ...days.map((day) => day.count));
  const matches = search.trim().length >= 2 ? (results?.items ?? []) : [];

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="eyebrow">Front desk</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">Check-ins</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today
            ? `${today.items.length} logged today · ${today.uniqueMembers} members in`
            : "Reading the log…"}
        </p>
      </header>

      {staged?.member && (
        <section className="flex items-center gap-3 rounded-lg border border-foreground/20 bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs">
            {initials(staged.member.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{staged.member.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {staged.member.planLabel} ·{" "}
              <span className="figure">
                {formatRenewal(staged.member.renewsAt)}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear selected member"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            <X className="size-4" />
          </Button>
          <Button
            onClick={() =>
              handleCheckIn(staged.member._id, staged.member.name)
            }
            disabled={busyId === staged.member._id}
          >
            {busyId === staged.member._id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            Check in
          </Button>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="eyebrow">Log a visit</p>
        </div>
        <div className="relative border-b border-border">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find an active member"
            className="h-12 rounded-none border-0 pl-9 shadow-none focus-visible:ring-0"
            autoComplete="off"
          />
        </div>

        {search.trim().length >= 2 &&
          (matches.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted-foreground">
              No active member matches “{search.trim()}”.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.slice(0, 6).map((member) => {
                const isIn = checkedInToday.has(String(member._id));
                return (
                  <li
                    key={member._id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[11px]">
                      {initials(member.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {member.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {member.planLabel}
                      </span>
                    </span>
                    {isIn ? (
                      <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-emerald-800">
                        <Check className="size-3.5" />
                        IN
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shadow-none"
                        disabled={busyId === member._id}
                        onClick={() => handleCheckIn(member._id, member.name)}
                      >
                        {busyId === member._id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <LogIn className="size-3.5" />
                        )}
                        Check in
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="eyebrow">Today</p>
          <p className="eyebrow">
            {today ? `${today.items.length} visits` : "—"}
          </p>
        </div>

        {today === undefined ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : today.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nobody has checked in yet today.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {today.items.map((item) => (
              <li
                key={item._id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="figure w-14 shrink-0 text-xs text-muted-foreground">
                  {formatTime(item.at)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.memberName}
                </span>
                <span
                  className={cn(
                    "hidden rounded-full border px-2 py-0.5 font-mono text-[10.5px] sm:inline-flex",
                    item.status === "active"
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-rose-600/30 bg-rose-50 text-rose-700",
                  )}
                >
                  {item.status}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Undo ${item.memberName}'s check-in`}
                  onClick={() => handleUndo(item._id, item.memberName)}
                >
                  <Undo2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="eyebrow">Last 7 days</p>
          <p className="eyebrow">
            {activity
              ? `${activity.length} visits`
              : "—"}
          </p>
        </div>
        <div className="flex items-end gap-2 px-4 pb-4 pt-6">
          {days.map((day) => {
            const label = new Intl.DateTimeFormat("en-US", {
              weekday: "short",
            }).format(new Date(day.dayStart));
            return (
              <div key={day.dayStart} className="flex flex-1 flex-col items-center gap-2">
                <span className="figure text-[11px] text-muted-foreground">
                  {day.count}
                </span>
                <div className="flex h-16 w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      day.count > 0 ? "bg-foreground/85" : "bg-border",
                    )}
                    style={{
                      height: `${day.count > 0 ? Math.max(8, (day.count / busiest) * 100) : 3}%`,
                    }}
                  />
                </div>
                <span className="eyebrow">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Dues collected at the desk are marked from the member&apos;s home screen.
      </p>
    </div>
  );
}
