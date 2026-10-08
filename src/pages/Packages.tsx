import { DataTable, type Column } from "@/components/workspace/DataTable";
import {
  EmptyState,
  PageHeader,
  SkeletonRows,
  StatusChip,
} from "@/components/workspace/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMoney } from "@/lib/gym";
import { useMutation, useQuery } from "convex/react";
import { Archive, Loader2, PackagePlus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PackageRow = {
  _id: Id<"packages">;
  name: string;
  kind: string;
  durationMonths: number;
  gymFeeCents: number;
  regFeeCents: number;
  ptFeeCents: number;
  details?: string;
  status: string;
  activeMembers: number;
};

type AddOnRow = {
  _id: Id<"addOns">;
  name: string;
  priceCents: number;
  details?: string;
  status: string;
};

/** Packages & Add-ons: the sellable catalog the fee modal pulls from. */
export default function Packages() {
  const [addingPackage, setAddingPackage] = useState(false);
  const [addingAddOn, setAddingAddOn] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const packages = useQuery(api.catalogAdmin.listPackages, {});
  const addOns = useQuery(api.catalogAdmin.listAddOns, {});
  const archivePackage = useMutation(api.catalogAdmin.archivePackage);
  const archiveAddOn = useMutation(api.catalogAdmin.archiveAddOn);

  const packageColumns: Column<PackageRow>[] = [
    {
      key: "name",
      header: "Package Name",
      sortValue: (row) => row.name,
      render: (row) => <span className="text-sm font-medium">{row.name}</span>,
    },
    {
      key: "kind",
      header: "Type",
      sortValue: (row) => row.kind,
      render: (row) => (
        <StatusChip status={row.kind === "pt" ? "trainer" : "member"} />
      ),
    },
    {
      key: "duration",
      header: "Duration",
      sortValue: (row) => row.durationMonths,
      render: (row) => (
        <span className="text-sm">
          {row.durationMonths} month{row.durationMonths === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      key: "gym",
      header: "Gym Fee",
      align: "right",
      sortValue: (row) => row.gymFeeCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.gymFeeCents)}</span>
      ),
    },
    {
      key: "reg",
      header: "Reg. Fee",
      align: "right",
      sortValue: (row) => row.regFeeCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.regFeeCents)}</span>
      ),
    },
    {
      key: "pt",
      header: "PT Fee",
      align: "right",
      sortValue: (row) => row.ptFeeCents,
      render: (row) => (
        <span className="figure text-sm">
          {row.ptFeeCents > 0 ? formatMoney(row.ptFeeCents) : "Waived"}
        </span>
      ),
    },
    {
      key: "members",
      header: "Active Members",
      align: "right",
      sortValue: (row) => row.activeMembers,
      render: (row) => (
        <span className="figure text-sm">{row.activeMembers}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => <StatusChip status={row.status === "active" ? "active" : "expired"} />,
    },
    {
      key: "details",
      header: "Package Details",
      render: (row) => (
        <span className="line-clamp-2 max-w-56 text-xs text-muted-foreground">
          {row.details || "—"}
        </span>
      ),
    },
  ];

  const addOnColumns: Column<AddOnRow>[] = [
    {
      key: "name",
      header: "Add-on",
      sortValue: (row) => row.name,
      render: (row) => <span className="text-sm font-medium">{row.name}</span>,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortValue: (row) => row.priceCents,
      render: (row) => (
        <span className="figure text-sm">{formatMoney(row.priceCents)}</span>
      ),
    },
    {
      key: "details",
      header: "Details",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.details || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      render: (row) => (
        <StatusChip status={row.status === "active" ? "active" : "expired"} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Catalog"
        title="Packages & Add-ons"
        lede="What the desk sells: memberships, PT bundles and the extras on top."
        actions={
          <>
            <Button variant="outline" className="shadow-none" onClick={() => setAddingAddOn(true)}>
              <Plus className="size-4" />
              Add-on
            </Button>
            <Button onClick={() => setAddingPackage(true)}>
              <PackagePlus className="size-4" />
              Add package
            </Button>
          </>
        }
      />

      <Tabs defaultValue="packages" className="flex flex-col gap-5">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>

        <TabsContent value="packages">
          {packages === undefined ? (
            <SkeletonRows rows={4} />
          ) : packages.items.length === 0 ? (
            <EmptyState
              title="No packages yet"
              body="Create the first package — Monthly Basic, PT Premium, Quarterly Pro — and it becomes selectable in the fee modal."
              action={
                <Button onClick={() => setAddingPackage(true)}>
                  <PackagePlus className="size-4" />
                  Add package
                </Button>
              }
            />
          ) : (
            <DataTable<PackageRow>
              columns={packageColumns}
              rows={packages.items as unknown as PackageRow[]}
              rowKey={(row) => row._id}
              initialSort={{ key: "name", direction: "asc" }}
              actions={(row) => (
                <div className="relative">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Row actions"
                    onClick={() =>
                      setMenuFor((current) =>
                        current === row._id ? null : row._id,
                      )
                    }
                  >
                    ⋯
                  </Button>
                  {menuFor === row._id && (
                    <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md">
                      <button
                        type="button"
                        className="w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                        onClick={async () => {
                          setMenuFor(null);
                          try {
                            await archivePackage({ packageId: row._id });
                            toast.success(
                              row.status === "active"
                                ? `${row.name} archived`
                                : `${row.name} restored`,
                            );
                          } catch {
                            toast.error("Could not update that package.");
                          }
                        }}
                      >
                        <Archive className="mr-1.5 inline size-3.5" />
                        {row.status === "active" ? "Archive" : "Restore"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            />
          )}
        </TabsContent>

        <TabsContent value="addons">
          {addOns === undefined ? (
            <SkeletonRows rows={4} />
          ) : addOns.items.length === 0 ? (
            <EmptyState
              title="No add-ons yet"
              body="Add extras like locker rental or sauna access and assign them to members."
              action={
                <Button onClick={() => setAddingAddOn(true)}>
                  <Plus className="size-4" />
                  Add add-on
                </Button>
              }
            />
          ) : (
            <DataTable<AddOnRow>
              columns={addOnColumns}
              rows={addOns.items as unknown as AddOnRow[]}
              rowKey={(row) => row._id}
              initialSort={{ key: "name", direction: "asc" }}
              actions={(row) => (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={async () => {
                    try {
                      await archiveAddOn({ addOnId: row._id });
                      toast.success(
                        row.status === "active"
                          ? `${row.name} archived`
                          : `${row.name} restored`,
                      );
                    } catch {
                      toast.error("Could not update that add-on.");
                    }
                  }}
                >
                  {row.status === "active" ? "Archive" : "Restore"}
                </Button>
              )}
            />
          )}
        </TabsContent>
      </Tabs>

      <AddPackageDialog open={addingPackage} onOpenChange={setAddingPackage} />
      <AddOnDialog open={addingAddOn} onOpenChange={setAddingAddOn} />
    </div>
  );
}

function rupeesToCents(value: string) {
  const rupees = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

function AddPackageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useMutation(api.catalogAdmin.upsertPackage);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Package name is required.");
      return;
    }
    const durationMonths = Number(form.get("duration") ?? 1);
    if (durationMonths < 1 || durationMonths > 24) {
      toast.error("Duration must be between 1 and 24 months.");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        name,
        kind: String(form.get("kind")) as "gym" | "pt",
        durationMonths,
        gymFeeCents: rupeesToCents(String(form.get("gymFee") ?? "0")),
        regFeeCents: rupeesToCents(String(form.get("regFee") ?? "0")),
        ptFeeCents: rupeesToCents(String(form.get("ptFee") ?? "0")),
        includeGymFee: form.get("includeGym") === "on",
        includeRegFee: form.get("includeReg") === "on",
        includePtFee: form.get("includePt") === "on",
        details: String(form.get("details") ?? "").trim() || undefined,
      });
      toast.success(`${name} saved`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save the package.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="tracking-tight">Add package</DialogTitle>
            <DialogDescription>
              Name, duration and the three fees that make up the total.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="pkg-name">Package name *</Label>
              <Input id="pkg-name" name="name" placeholder="Monthly Basic" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pkg-kind">Package type *</Label>
                <Select name="kind" defaultValue="gym">
                  <SelectTrigger id="pkg-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gym">Gym</SelectItem>
                    <SelectItem value="pt">Personal Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pkg-duration">Duration (months) *</Label>
                <Input
                  id="pkg-duration"
                  name="duration"
                  type="number"
                  min={1}
                  max={24}
                  defaultValue={1}
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <FeeRow
                id="gym-fee"
                name="gymFee"
                label="Gym fee (PKR)"
                checkboxName="includeGym"
                checkboxLabel="Include package fee"
              />
              <FeeRow
                id="reg-fee"
                name="regFee"
                label="Registration fee (PKR)"
                checkboxName="includeReg"
                checkboxLabel="Include registration fee"
              />
              <FeeRow
                id="pt-fee"
                name="ptFee"
                label="PT fee / month (PKR)"
                checkboxName="includePt"
                checkboxLabel="Include PT fee"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pkg-details">Package details</Label>
              <Textarea
                id="pkg-details"
                name="details"
                rows={3}
                className="resize-none"
                placeholder="What's included, who it's for, cancellation terms…"
              />
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
              Save package
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeeRow({
  id,
  name,
  label,
  checkboxName,
  checkboxLabel,
}: {
  id: string;
  name: string;
  label: string;
  checkboxName: string;
  checkboxLabel: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Input id={id} name={name} inputMode="decimal" placeholder="0" className="flex-1" />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <Checkbox name={checkboxName} defaultChecked />
          {checkboxLabel}
        </label>
      </div>
    </div>
  );
}

function AddOnDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useMutation(api.catalogAdmin.upsertAddOn);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      toast.error("Add-on name is required.");
      return;
    }
    setSaving(true);
    try {
      await upsert({
        name,
        priceCents: rupeesToCents(String(form.get("price") ?? "0")),
        details: String(form.get("details") ?? "").trim() || undefined,
      });
      toast.success(`${name} saved`);
      onOpenChange(false);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save the add-on.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="tracking-tight">Add add-on</DialogTitle>
            <DialogDescription>
              An extra service members can attach to their membership.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="addon-name">Name *</Label>
              <Input id="addon-name" name="name" placeholder="Locker rental" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addon-price">Price (PKR) *</Label>
              <Input
                id="addon-price"
                name="price"
                inputMode="decimal"
                placeholder="0"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addon-details">Details</Label>
              <Textarea
                id="addon-details"
                name="details"
                rows={2}
                className="resize-none"
              />
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
              Save add-on
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
