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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CADENCE_OPTIONS,
  CATALOG_STATUS_OPTIONS,
  formatMoney,
  type Cadence,
  type CatalogStatus,
} from "@/lib/gym";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type EditableItem = {
  _id: Id<"catalogItems">;
  name: string;
  tagline: string;
  description: string;
  category: string;
  priceCents: number;
  cadence: Cadence;
  capacity: number;
  features: string[];
  status: CatalogStatus;
};

/** One form for adding an item to the catalog and for editing it later. */
export function CatalogItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: EditableItem;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-xl">
        <CatalogItemForm item={item} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CatalogItemForm({
  item,
  onDone,
}: {
  item?: EditableItem;
  onDone: () => void;
}) {
  const isEdit = Boolean(item);
  const createItem = useMutation(api.catalog.create);
  const updateItem = useMutation(api.catalog.update);

  const [cadence, setCadence] = useState<Cadence>(item?.cadence ?? "monthly");
  const [status, setStatus] = useState<CatalogStatus>(item?.status ?? "published");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const price = Number.parseFloat(String(form.get("price") ?? "0"));
    const capacity = Number.parseInt(String(form.get("capacity") ?? "12"), 10);
    const features = String(form.get("features") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!name) {
      setError("A name is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a price of zero or more.");
      setSaving(false);
      return;
    }

    const payload = {
      name,
      tagline: String(form.get("tagline") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? ""),
      priceCents: Math.round(price * 100),
      cadence,
      capacity: Number.isFinite(capacity) ? capacity : 12,
      features,
      status,
    };

    try {
      if (item) {
        await updateItem({ itemId: item._id, ...payload });
        toast.success(`${name} updated`);
      } else {
        await createItem(payload);
        toast.success(`${name} added to the catalog`, {
          description: `${formatMoney(payload.priceCents)} · ${status}`,
        });
      }
      onDone();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not save the item.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="tracking-tight">
          {isEdit ? "Edit catalog item" : "New catalog item"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update pricing, positioning or availability."
            : "Memberships, class packs, inductions, day passes — anything you sell."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              name="name"
              defaultValue={item?.name}
              placeholder="Unlimited membership"
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-category">Category</Label>
            <Input
              id="item-category"
              name="category"
              defaultValue={item?.category}
              placeholder="Memberships"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-tagline">Tagline</Label>
          <Input
            id="item-tagline"
            name="tagline"
            defaultValue={item?.tagline}
            placeholder="Every class, every hour, one price"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="item-price">Price (USD)</Label>
            <Input
              id="item-price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={item ? item.priceCents / 100 : 79}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-cadence">Billing</Label>
            <Select
              value={cadence}
              onValueChange={(value) => setCadence(value as Cadence)}
            >
              <SelectTrigger id="item-cadence" className="w-full">
                <SelectValue placeholder="Billing" />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="item-capacity">Seats per session</Label>
            <Input
              id="item-capacity"
              name="capacity"
              type="number"
              min="1"
              defaultValue={item?.capacity ?? 12}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-description">Description</Label>
          <Textarea
            id="item-description"
            name="description"
            rows={3}
            defaultValue={item?.description}
            placeholder="What the member gets, in plain language."
            className="resize-none"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-features">Included — one per line</Label>
          <Textarea
            id="item-features"
            name="features"
            rows={4}
            defaultValue={item?.features.join("\n")}
            placeholder={"24/7 floor access\nAll group sessions\nGuest pass each month"}
            className="resize-none font-mono text-xs"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="item-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as CatalogStatus)}
          >
            <SelectTrigger id="item-status" className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {CATALOG_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only published items can be sold at checkout.
          </p>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save item" : "Create item"}
        </Button>
      </DialogFooter>
    </form>
  );
}
