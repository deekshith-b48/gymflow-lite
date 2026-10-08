import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  Stat,
  StatGrid,
  StatusChip,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney, initials } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Dumbbell, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

type TrainerRow = {
  _id: Id<"trainers">;
  name: string;
  specialty?: string;
  status: string;
  commissionBps: number;
  salaryCents: number;
  memberCount: number;
  commissionCents: number;
  monthlyCostCents: number;
  joinedAt: number;
};

/**
 * Personal trainers: cards-with-numbers on top of the roster table — members
 * assigned, commission earned this month and total cost to the gym.
 */
export default function Trainers() {
  const [adding, setAdding] = useState(false);
  const trainers = useQuery(api.catalogAdmin.listTrainers, {});
  const stats = trainers?.stats;

  const columns: Column<TrainerRow>[] = [
    {
      key: "name",
      header: "Trainer",
      sortValue: (row) => row.name,
      render: (row) => (
        <Link
          to={`/dashboard/trainers/${row._id}`}
          className="flex items-center gap-2.5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px]">
            {initials(row.name)}
          </span>
          <span>
            <span className="block text-sm font-medium">{row.name}</span>
            <span className="block text-xs text-muted-foreground">
              {row.specialty ?? "General"}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status} />,
    },
    {
      key: "members",
      header: "Members",
      align: "right",
      sortValue: (row) => row.memberCount,
      render: (row) => <span className="figure text-sm">{row.memberCount}</span>,
    },
    {
      key: "commission",
      header: "Commission",
      align: "right",
      sortValue: (row) => row.commissionBps,
      render: (row) => (
        <span className="figure text-sm">{row.commissionBps / 100}%</span>
      ),
    },
    {
      key: "cost",
      header: "Monthly Cost",
      align: "right",
      sortValue: (row) => row.monthlyCostCents,
      render: (row) => (
        <span className="figure text-sm">
          {formatMoney(row.monthlyCostCents)}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortValue: (row) => row.joinedAt,
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {formatDate(row.joinedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Team"
        title="Personal Trainers"
        lede="Commission, assigned members and what each trainer costs the gym."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add trainer
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Active Trainers"
          value={stats ? String(stats.active) : "—"}
          loading={stats === undefined}
          tone="good"
        />
        <Stat
          label="Members Assigned"
          value={stats ? String(stats.membersAssigned) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Total Trainer Cost"
          value={stats ? formatMoney(stats.totalCostCents) : "—"}
          loading={stats === undefined}
          hint="Salary + commission this month"
        />
        <Stat
          label="Trainer Count"
          value={stats ? String(trainers!.items.length) : "—"}
          loading={stats === undefined}
        />
      </StatGrid>

      {trainers === undefined ? (
        <SkeletonRows rows={4} />
      ) : trainers.items.length === 0 ? (
        <EmptyState
          title="No trainers yet"
          body="Add the first personal trainer, set their commission rate, and their payment history starts here."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add trainer
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {trainers.items.map((trainer) => (
              <Link
                key={trainer._id}
                to={`/dashboard/trainers/${trainer._id}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-full border border-border bg-muted font-mono text-sm">
                      {initials(trainer.name)}
                    </span>
                    <div>
                      <p className="font-semibold tracking-tight">
                        {trainer.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trainer.specialty ?? "General training"}
                      </p>
                    </div>
                  </div>
                  <StatusChip status={trainer.status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
                  <div className="bg-card px-3 py-2.5">
                    <p className="eyebrow">Members</p>
                    <p className="figure mt-1 text-lg font-medium">
                      {trainer.memberCount}
                    </p>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <p className="eyebrow">Commission</p>
                    <p className="figure mt-1 text-lg font-medium">
                      {trainer.commissionBps / 100}%
                    </p>
                  </div>
                  <div className="bg-card px-3 py-2.5">
                    <p className="eyebrow">Monthly cost</p>
                    <p className="figure mt-1 text-lg font-medium">
                      {formatMoney(trainer.monthlyCostCents)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Salary {formatMoney(trainer.salaryCents)}/mo</span>
                  <span className="inline-flex items-center gap-1 transition-colors group-hover:text-foreground">
                    View profile
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <DataTable<TrainerRow>
            columns={columns}
            rows={trainers.items as unknown as TrainerRow[]}
            rowKey={(row) => row._id}
            initialSort={{ key: "name", direction: "asc" }}
            actions={(row) => (
              <Button asChild size="sm" variant="ghost" className="h-8">
                <Link to={`/dashboard/trainers/${row._id}`}>Open</Link>
              </Button>
            )}
          />
        </>
      )}

      <AddTrainerDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function rupeesToCents(value: string) {
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function AddTrainerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useMutation(api.catalogAdmin.upsertTrainer);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Trainer name is required.");
      return;
    }
    const commissionPercent = Number(form.get("commission") ?? "0");
    setSaving(true);
    try {
      await upsert({
        name,
        email: String(form.get("email") ?? "").trim() || undefined,
        phone: String(form.get("phone") ?? "").trim() || undefined,
        specialty: String(form.get("specialty") ?? "").trim() || undefined,
        status: "active",
        commissionBps: Math.round(commissionPercent * 100),
        salaryCents: rupeesToCents(String(form.get("salary") ?? "0")),
      });
      toast.success(`${name} added`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not add the trainer.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="tracking-tight">Add trainer</DialogTitle>
            <DialogDescription>
              Commission is applied to PT fees they collect each month.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="trainer-name">Name *</Label>
              <Input id="trainer-name" name="name" placeholder="Sara Khan" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="trainer-specialty">Specialty</Label>
              <Input
                id="trainer-specialty"
                name="specialty"
                placeholder="HIIT & Functional"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="trainer-email">Email</Label>
                <Input id="trainer-email" name="email" type="email" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trainer-phone">Phone</Label>
                <Input id="trainer-phone" name="phone" placeholder="300 1234567" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trainer-salary">Monthly salary (PKR)</Label>
                <Input
                  id="trainer-salary"
                  name="salary"
                  inputMode="decimal"
                  placeholder="40000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="trainer-commission">Commission (%)</Label>
                <Input
                  id="trainer-commission"
                  name="commission"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={12}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Dumbbell className="size-4" />
              )}
              Add trainer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
