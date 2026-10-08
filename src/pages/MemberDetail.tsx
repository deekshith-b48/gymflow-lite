import { MemberFormDialog } from "@/components/MemberFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  cycleProgress,
  daysUntil,
  duesBadgeClass,
  duesTextClass,
  formatDate,
  formatDateTime,
  formatMoney,
  formatRecency,
  formatRenewal,
  initials,
  planDurationDays,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  BadgeCheck,
  Loader2,
  LogIn,
  Mail,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { toast } from "sonner";

/**
 * The member's home screen. Plan & dues is the one thing a member needs at a
 * glance, so it sits at the top, above the operator tooling (check in, edit,
 * remove) that the front desk also needs here.
 */
export default function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const data = useQuery(
    api.members.get,
    memberId ? { memberId: memberId as Id<"members"> } : "skip",
  );

  const checkIn = useMutation(api.checkIns.checkIn);
  const settleDues = useMutation(api.members.settleDues);
  const removeMember = useMutation(api.members.remove);

  if (data === undefined) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-sm font-medium">That member is gone</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The record was deleted, or the link is out of date.
        </p>
        <Button asChild variant="outline" className="mt-5 shadow-none">
          <Link to="/dashboard/members">Back to the roster</Link>
        </Button>
      </div>
    );
  }

  const { member, checkIns, stats } = data;
  const owed = member.duesAmountCents > 0;
  const daysLeft = Math.max(0, daysUntil(member.renewsAt));
  const progress = cycleProgress(member.planStartedAt, member.renewsAt);

  async function handleCheckIn() {
    setBusy(true);
    try {
      const result = await checkIn({ memberId: member._id });
      toast.success(
        result.duplicate
          ? `${member.name} was just checked in`
          : `${member.name} checked in`,
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not check in.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSettle() {
    setBusy(true);
    try {
      await settleDues({ memberId: member._id });
      toast.success(`Dues settled for ${member.name}`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not record payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    try {
      await removeMember({ memberId: member._id });
      toast(`${member.name} removed from the roster`);
      navigate("/dashboard/members");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove member.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <Link
        to="/dashboard/members"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Roster
      </Link>

      <header className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-sm">
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Member home</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {member.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.14em]">
              {member.status}
            </span>
            <span aria-hidden>·</span>
            <span>Joined {formatDate(member.joinedAt)}</span>
            <span aria-hidden>·</span>
            <span className="figure">{stats.totalVisits} visits</span>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5">
          <div>
            <p className="eyebrow">My plan &amp; dues</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {member.planLabel}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="figure">
                {formatMoney(member.planPriceCents)}
              </span>{" "}
              per {planDurationDays(member.plan)} days ·{" "}
              {formatRenewal(member.renewsAt)}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-wide",
              duesBadgeClass(member.dues.state),
            )}
          >
            {member.dues.label}
          </span>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Balance</p>
            <p
              className={cn(
                "figure mt-1.5 text-3xl font-medium",
                duesTextClass(member.dues.state),
              )}
            >
              {formatMoney(member.duesAmountCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {owed
                ? member.duesDueAt
                  ? `Due ${formatDate(member.duesDueAt)}`
                  : "No due date on file"
                : "Paid up for this cycle"}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Cycle</p>
            <p className="figure mt-1.5 text-3xl font-medium">
              {daysLeft}
              <span className="ml-1 text-base text-muted-foreground">days left</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Started {formatDate(member.planStartedAt)}
            </p>
          </div>
        </div>

        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-foreground"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          {owed ? (
            <Button onClick={handleSettle} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BadgeCheck className="size-4" />
              )}
              Mark dues paid
            </Button>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <BadgeCheck className="size-4" />
              Nothing owed
            </span>
          )}

          <Button
            variant="outline"
            className="gap-2 shadow-none"
            onClick={handleCheckIn}
            disabled={busy || stats.checkedInToday}
          >
            <LogIn className="size-4" />
            {stats.checkedInToday ? "Checked in today" : "Check in"}
          </Button>

          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
            Edit
          </Button>

          <Button
            variant="ghost"
            className="ml-auto gap-2 text-muted-foreground hover:text-rose-300"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Email</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <Mail className="size-3.5 text-muted-foreground" />
            {member.email ?? "—"}
          </p>
        </div>
        <div className="bg-card px-5 py-4">
          <p className="eyebrow">Phone</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <Phone className="size-3.5 text-muted-foreground" />
            {member.phone ?? "—"}
          </p>
        </div>
        {member.note && (
          <div className="bg-card px-5 py-4 sm:col-span-2">
            <p className="eyebrow">Note</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {member.note}
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="eyebrow">Visits</p>
          <p className="eyebrow">
            {stats.visits30d} in the last 30 days
          </p>
        </div>
        {checkIns.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No visits logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {checkIns.map((visit) => (
              <li
                key={visit._id}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <span className="figure text-sm">{formatDateTime(visit.at)}</span>
                <span className="eyebrow">
                  {formatRecency(visit.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MemberFormDialog
        open={editing}
        onOpenChange={setEditing}
        member={member}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their plan, dues and {stats.totalVisits} logged visits are deleted
              with them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep member</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
