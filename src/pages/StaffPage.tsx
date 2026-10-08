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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate, formatMoney } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type StaffRow = {
  _id: Id<"users">;
  staffCode: string | null;
  name: string;
  email: string;
  role: string;
  staffStatus: string;
  salaryCents: number;
  lastLoginAt: number | null;
  title: string | null;
};

/**
 * Users & Staff: the directory of everyone with a login, their role badge,
 * salary and invite state — plus the Add Staff invite form.
 */
export default function StaffPage() {
  const [adding, setAdding] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const staff = useQuery(api.staffDirectory.list, {});
  const updateStaff = useMutation(api.staffDirectory.update);
  const stats = staff?.stats;

  const columns: Column<StaffRow>[] = [
    {
      key: "code",
      header: "Staff ID",
      sortValue: (row) => row.staffCode ?? "",
      render: (row) => (
        <span className="figure text-xs text-muted-foreground">
          {row.staffCode ?? "—"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px]">
            {row.name
              .split(/\s+/)
              .map((part) => part[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {row.name}
            </span>
            {row.title && (
              <span className="block truncate text-xs text-muted-foreground">
                {row.title}
              </span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.email || "—"}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (row) => row.role,
      render: (row) => <StatusChip status={row.role} />,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.staffStatus,
      render: (row) => <StatusChip status={row.staffStatus} />,
    },
    {
      key: "salary",
      header: "Salary",
      align: "right",
      sortValue: (row) => row.salaryCents,
      render: (row) => (
        <span className="figure text-sm">
          {row.salaryCents > 0 ? formatMoney(row.salaryCents) : "—"}
        </span>
      ),
    },
    {
      key: "login",
      header: "Last Login",
      sortValue: (row) => row.lastLoginAt ?? 0,
      render: (row) =>
        row.lastLoginAt ? (
          <span className="figure text-xs text-muted-foreground">
            {formatDate(row.lastLoginAt)}
          </span>
        ) : (
          <span className="text-xs text-amber-300">Pending invite</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Team"
        title="Users & Staff"
        lede="Everyone with a login, the role they hold and what they cost."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add staff
          </Button>
        }
      />

      <StatGrid>
        <Stat
          label="Total Staff"
          value={stats ? String(stats.total) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Active"
          value={stats ? String(stats.active) : "—"}
          loading={stats === undefined}
          tone="good"
        />
        <Stat
          label="Inactive"
          value={stats ? String(stats.inactive) : "—"}
          loading={stats === undefined}
        />
        <Stat
          label="Total Salary"
          value={stats ? formatMoney(stats.salaryCents) : "—"}
          loading={stats === undefined}
          hint="Per month"
        />
      </StatGrid>

      {staff === undefined ? (
        <SkeletonRows rows={5} />
      ) : staff.items.length === 0 ? (
        <EmptyState
          title="No staff yet"
          body="Invite the first team member and their role, salary and last login show up here."
          action={
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add staff
            </Button>
          }
        />
      ) : (
        <DataTable<StaffRow>
          columns={columns}
          rows={staff.items as unknown as StaffRow[]}
          rowKey={(row) => row._id}
          initialSort={{ key: "name", direction: "asc" }}
          actions={(row) => (
            <div className="relative">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Row actions"
                onClick={() =>
                  setMenuFor((current) => (current === row._id ? null : row._id))
                }
              >
                ⋯
              </Button>
              {menuFor === row._id && (
                <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={async () => {
                      setMenuFor(null);
                      const next =
                        row.staffStatus === "active" ? "inactive" : "active";
                      try {
                        await updateStaff({
                          userId: row._id,
                          staffStatus: next,
                        });
                        toast.success(`${row.name} marked ${next}`);
                      } catch (caught) {
                        toast.error(
                          caught instanceof Error
                            ? caught.message
                            : "Could not update staff.",
                        );
                      }
                    }}
                  >
                    Mark {row.staffStatus === "active" ? "inactive" : "active"}
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={async () => {
                      setMenuFor(null);
                      const next =
                        row.role === "receptionist" ? "trainer" : "receptionist";
                      try {
                        await updateStaff({ userId: row._id, role: next as never });
                        toast.success(`${row.name} is now ${next}`);
                      } catch (caught) {
                        toast.error(
                          caught instanceof Error
                            ? caught.message
                            : "Could not change role.",
                        );
                      }
                    }}
                  >
                    Switch to {row.role === "receptionist" ? "trainer" : "receptionist"}
                  </button>
                </div>
              )}
            </div>
          )}
        />
      )}

      <AddStaffDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function rupeesToCents(value: string) {
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function AddStaffDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addStaff = useMutation(api.staffDirectory.add);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (!name || !email) {
      toast.error("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      await addStaff({
        name,
        email,
        role: String(form.get("role") ?? "user") as
          | "admin"
          | "user"
          | "member"
          | "manager"
          | "receptionist"
          | "trainer",
        salaryCents: rupeesToCents(String(form.get("salary") ?? "0")),
        title: String(form.get("title") ?? "").trim() || undefined,
        phone: String(form.get("phone") ?? "").trim() || undefined,
      });
      toast.success(`${name} invited`, {
        description: "They join the directory when they accept the invite.",
      });
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not add staff.",
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
            <DialogTitle className="tracking-tight">Add staff</DialogTitle>
            <DialogDescription>
              They show up as pending until they sign in for the first time.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="staff-name">Name *</Label>
              <Input id="staff-name" name="name" placeholder="Full name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff-email">Email *</Label>
              <Input
                id="staff-email"
                name="email"
                type="email"
                placeholder="staff@gym.com"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="staff-role">Role</Label>
                <Select name="role" defaultValue="receptionist">
                  <SelectTrigger id="staff-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-title">Title</Label>
                <Input
                  id="staff-title"
                  name="title"
                  placeholder="Front desk, Trainer…"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-salary">Monthly salary (PKR)</Label>
                <Input
                  id="staff-salary"
                  name="salary"
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-phone">Phone</Label>
                <Input id="staff-phone" name="phone" placeholder="300 1234567" />
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
              {saving && <Loader2 className="size-4 animate-spin" />}
              Add staff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
