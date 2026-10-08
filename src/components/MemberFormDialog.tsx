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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  formatMoney,
  MEMBER_STATUS_OPTIONS,
  PLAN_OPTIONS,
  type MemberStatus,
} from "@/lib/gym";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export type EditableMember = {
  _id: Id<"members">;
  name: string;
  email?: string;
  phone?: string;
  plan: string;
  status: MemberStatus;
  note?: string;
};

/**
 * One dialog for both halves of the same job: adding someone to the roster and
 * editing the record later. Both screens render the same fields so a member
 * looks the same wherever the desk opens them.
 */
export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: EditableMember;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-lg">
        <MemberForm
          member={member}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function MemberForm({
  member,
  onDone,
}: {
  member?: EditableMember;
  onDone: () => void;
}) {
  const isEdit = Boolean(member);
  const navigate = useNavigate();
  const createMember = useMutation(api.members.create);
  const updateMember = useMutation(api.members.update);

  const [plan, setPlan] = useState(member?.plan ?? "monthly");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "active");
  const [firstPaymentCollected, setFirstPaymentCollected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = PLAN_OPTIONS.find((option) => option.id === plan);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    if (!name) {
      setError("A name is required.");
      setSaving(false);
      return;
    }

    try {
      if (member) {
        await updateMember({
          memberId: member._id,
          name,
          email,
          phone,
          note,
          plan,
          status,
        });
        toast.success(`${name} updated`);
        onDone();
      } else {
        const memberId = await createMember({
          name,
          email,
          phone,
          note,
          plan,
          firstPaymentCollected,
        });
        toast.success(`${name} added to the roster`, {
          description: firstPaymentCollected
            ? "First cycle paid in full."
            : `${formatMoney(selectedPlan?.priceCents ?? 0)} recorded as owed.`,
        });
        onDone();
        navigate(`/dashboard/members/${memberId}`);
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Something went wrong.";
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
          {isEdit ? "Edit member" : "Add member"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the plan, status or contact details."
            : "Name and plan are enough to start. Everything else can wait."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-5">
        <div className="grid gap-2">
          <Label htmlFor="member-name">Name</Label>
          <Input
            id="member-name"
            name="name"
            defaultValue={member?.name}
            placeholder="Full name"
            autoComplete="off"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              name="email"
              type="email"
              defaultValue={member?.email}
              placeholder="optional"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="member-phone">Phone</Label>
            <Input
              id="member-phone"
              name="phone"
              defaultValue={member?.phone}
              placeholder="optional"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="member-plan">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger id="member-plan" className="w-full">
                <SelectValue placeholder="Pick a plan" />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label} · {formatMoney(option.priceCents)} /{" "}
                    {option.durationDays}d
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit ? (
            <div className="grid gap-2">
              <Label htmlFor="member-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as MemberStatus)}
              >
                <SelectTrigger id="member-status" className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="member-paid">First payment collected</Label>
              <div className="flex h-9 items-center gap-3 rounded-md border border-input px-3">
                <Switch
                  id="member-paid"
                  checked={firstPaymentCollected}
                  onCheckedChange={setFirstPaymentCollected}
                />
                <span className="text-sm text-muted-foreground">
                  {firstPaymentCollected
                    ? "Paid at sign-up"
                    : "Record as owed today"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="member-note">Note</Label>
          <Textarea
            id="member-note"
            name="note"
            defaultValue={member?.note}
            placeholder="Injuries, goals, anything the desk should know"
            rows={3}
            className="resize-none"
          />
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>

      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Add member"}
        </Button>
      </DialogFooter>
    </form>
  );
}
