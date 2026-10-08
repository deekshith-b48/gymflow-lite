import { SessionDialog } from "@/components/SessionDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatTime, startOfDay } from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { CalendarPlus, Clock, Loader2, MapPin, Trash2, User } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

/**
 * The schedule: every upcoming session grouped by day. Booking is one tap, and
 * cancelling is the same tap in reverse.
 */
export default function Schedule() {
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [todayStart] = useState(() => startOfDay(Date.now()));

  const schedule = useQuery(api.sessions.list, {});
  const catalog = useQuery(api.catalog.list, { status: "published" });

  const book = useMutation(api.sessions.book);
  const cancelBooking = useMutation(api.sessions.cancelBooking);
  const removeSession = useMutation(api.sessions.remove);

  const days = useMemo(() => {
    const items = schedule?.items ?? [];
    const grouped = new Map<number, (typeof items)[number][]>();
    for (const session of items) {
      const key = startOfDay(session.startsAt);
      const bucket = grouped.get(key) ?? [];
      bucket.push(session);
      grouped.set(key, bucket);
    }
    return Array.from(grouped.entries()).map(([dayStart, sessions]) => ({
      dayStart,
      sessions,
    }));
  }, [schedule]);

  async function handleBook(sessionId: Id<"sessions">, title: string) {
    setBusy(sessionId);
    try {
      const result = await book({ sessionId });
      toast.success(
        result.alreadyBooked ? `Already booked: ${title}` : `Booked: ${title}`,
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not book.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel(bookingId: Id<"bookings">, title: string) {
    setBusy(bookingId);
    try {
      await cancelBooking({ bookingId });
      toast(`Booking cancelled`, { description: title });
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not cancel.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(sessionId: Id<"sessions">, title: string) {
    try {
      await removeSession({ sessionId });
      toast(`${title} removed from the schedule`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove session.",
      );
    }
  }

  const catalogOptions =
    catalog?.items.map((item) => ({ _id: item._id, name: item.name })) ?? [];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
            Upcoming sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {schedule
              ? `${schedule.stats.upcoming} scheduled · ${schedule.stats.seatsLeft} seats open · ${schedule.stats.bookedByMe} booked by you`
              : "Loading the schedule…"}
          </p>
        </div>
        <Button className="self-start" onClick={() => setScheduling(true)}>
          <CalendarPlus className="size-4" />
          New session
        </Button>
      </header>

      {schedule === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : schedule.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border bg-card">
            <CalendarPlus className="size-4 text-primary" />
          </span>
          <p className="mt-4 text-sm font-medium">The calendar is clear</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add a session and it appears here for the whole workspace to book.
          </p>
          <Button className="mt-5" onClick={() => setScheduling(true)}>
            <CalendarPlus className="size-4" />
            New session
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => {
            const isToday = day.dayStart === todayStart;
            return (
              <section key={day.dayStart} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <p className="eyebrow">
                    {isToday
                      ? "Today"
                      : new Intl.DateTimeFormat("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(day.dayStart))}
                  </p>
                  <span className="h-px flex-1 bg-border" />
                  <span className="figure text-[11px] text-muted-foreground">
                    {day.sessions.length} session
                    {day.sessions.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {day.sessions.map((session, index) => (
                    <motion.li
                      key={session._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
                    >
                      <span className="figure w-16 shrink-0 text-sm">
                        {formatTime(session.startsAt)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {session.title}
                          {session.itemId && (
                            <Link
                              to={`/dashboard/catalog/${session.itemId}`}
                              className="ml-2 text-[11px] text-primary underline-offset-4 hover:underline"
                            >
                              item
                            </Link>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3" />
                            {session.coach}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" />
                            {session.room}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            {session.durationMinutes}min
                          </span>
                        </span>
                      </span>

                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                          session.spotsLeft === 0
                            ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                            : "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {session.spotsLeft === 0
                          ? "full"
                          : `${session.spotsLeft} left`}
                      </span>

                      {session.bookedByMe && session.myBookingId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shadow-none"
                          disabled={busy === session.myBookingId}
                          onClick={() =>
                            handleCancel(
                              session.myBookingId as Id<"bookings">,
                              session.title,
                            )
                          }
                        >
                          {busy === session.myBookingId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Booked · cancel"
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy === session._id || session.spotsLeft === 0}
                          onClick={() => handleBook(session._id, session.title)}
                        >
                          {busy === session._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Book"
                          )}
                        </Button>
                      )}

                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove ${session.title}`}
                        onClick={() => handleRemove(session._id, session.title)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </motion.li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <SessionDialog
        open={scheduling}
        onOpenChange={setScheduling}
        catalogOptions={catalogOptions}
      />
    </div>
  );
}
