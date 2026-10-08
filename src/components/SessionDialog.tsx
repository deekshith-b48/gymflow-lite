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
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Pads a date into the local `datetime-local` shape the input expects. */
export function toLocalInputValue(ms: number) {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SessionDialog({
  open,
  onOpenChange,
  catalogOptions,
  defaultItemId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogOptions: { _id: Id<"catalogItems">; name: string }[];
  defaultItemId?: Id<"catalogItems">;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-lg">
        <SessionForm
          catalogOptions={catalogOptions}
          defaultItemId={defaultItemId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SessionForm({
  catalogOptions,
  defaultItemId,
  onDone,
}: {
  catalogOptions: { _id: Id<"catalogItems">; name: string }[];
  defaultItemId?: Id<"catalogItems">;
  onDone: () => void;
}) {
  const createSession = useMutation(api.sessions.create);

  const [itemId, setItemId] = useState<string>(
    defaultItemId ?? catalogOptions[0]?._id ?? "none",
  );
  const [startsAt, setStartsAt] = useState(() =>
    toLocalInputValue(Date.now() + 24 * 60 * 60 * 1000),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const parsed = new Date(String(form.get("startsAt") ?? "")).getTime();

    if (!title) {
      setError("A title is required.");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(parsed)) {
      setError("Pick a start time.");
      setSaving(false);
      return;
    }

    try {
      await createSession({
        title,
        coach: String(form.get("coach") ?? ""),
        room: String(form.get("room") ?? ""),
        startsAt: parsed,
        durationMinutes: Number.parseInt(
          String(form.get("durationMinutes") ?? "45"),
          10,
        ),
        capacity: Number.parseInt(String(form.get("capacity") ?? "12"), 10),
        itemId:
          itemId === "none" ? undefined : (itemId as Id<"catalogItems">),
      });
      toast.success(`Session scheduled`, {
        description: `${title} · ${new Date(parsed).toLocaleString("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        })}`,
      });
      onDone();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not book the time.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="tracking-tight">Schedule a session</DialogTitle>
        <DialogDescription>
          A class, an induction or a court hour. Members book the times you add
          here.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-5">
        <div className="grid gap-2">
          <Label htmlFor="session-title">Title</Label>
          <Input
            id="session-title"
            name="title"
            placeholder="Strength circuit"
            autoComplete="off"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="session-starts">Starts</Label>
            <Input
              id="session-starts"
              name="startsAt"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="session-duration">Minutes</Label>
            <Input
              id="session-duration"
              name="durationMinutes"
              type="number"
              min="5"
              step="5"
              defaultValue={45}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="session-coach">Coach</Label>
            <Input
              id="session-coach"
              name="coach"
              placeholder="Unassigned"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="session-room">Room</Label>
            <Input
              id="session-room"
              name="room"
              placeholder="Main floor"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="session-capacity">Capacity</Label>
            <Input
              id="session-capacity"
              name="capacity"
              type="number"
              min="1"
              defaultValue={12}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="session-item">Catalog item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger id="session-item" className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No item attached</SelectItem>
                {catalogOptions.map((option) => (
                  <SelectItem key={option._id} value={option._id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Add to schedule
        </Button>
      </DialogFooter>
    </form>
  );
}
