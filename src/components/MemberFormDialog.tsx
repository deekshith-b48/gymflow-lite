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
import { useMutation, useQuery } from "convex/react";
import { Camera, Loader2, Upload, User } from "lucide-react";
import { useRef, useState } from "react";
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
  memberCode?: string | null;
  gender?: "male" | "female" | undefined;
  dob?: number | undefined;
  cnic?: string | undefined;
  address?: string | undefined;
  memberType?: "member" | "staff" | undefined;
  addOns?: string[] | undefined;
  photoStorageId?: Id<"_storage"> | undefined;
};

/**
 * One dialog for both halves of the same job: adding someone to the roster and
 * editing the record later. The form follows the desk's intake sheet —
 * personal, contact, membership, add-ons — so nothing has to be typed twice.
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-none sm:max-w-xl">
        <MemberForm member={member} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function toDateInput(ms?: number) {
  if (!ms) return "";
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day).getTime();
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
  const generateUploadUrl = useMutation(api.members.generateUploadUrl);
  const addOns = useQuery(api.catalogAdmin.listAddOns, {});

  const [plan, setPlan] = useState(member?.plan ?? "monthly");
  const [status, setStatus] = useState<MemberStatus>(member?.status ?? "active");
  const [gender, setGender] = useState<"male" | "female" | undefined>(
    member?.gender ?? undefined,
  );
  const [memberType, setMemberType] = useState<"member" | "staff">(
    member?.memberType ?? "member",
  );
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>(
    member?.addOns ?? [],
  );
  const [firstPaymentCollected, setFirstPaymentCollected] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    member?.photoStorageId
      ? `${import.meta.env.VITE_CONVEX_URL}/storage/${member.photoStorageId}`
      : null,
  );
  const [photoStorageId, setPhotoStorageId] = useState<
    Id<"_storage"> | undefined
  >(member?.photoStorageId);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const selectedPlan = PLAN_OPTIONS.find((option) => option.id === plan);
  const [firstName, ...restName] = member?.name.split(" ") ?? ["", ""];
  const existingCode = member?.memberCode ?? null;

  async function handlePhoto(file: File) {
    if (!/\.(jpg|jpeg|png)$/i.test(file.name)) {
      toast.error("Profile photos must be JPG or PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile photos must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed.");
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      setPhotoStorageId(storageId);
      setPhotoUrl(`${import.meta.env.VITE_CONVEX_URL}/storage/${storageId}`);
      toast.success("Photo uploaded");
    } catch {
      toast.error("Could not upload that photo. Try a smaller JPG or PNG.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const first = String(form.get("firstName") ?? "").trim();
    const last = String(form.get("lastName") ?? "").trim();
    const name = [first, last].filter(Boolean).join(" ");
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const cnic = String(form.get("cnic") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const dob = fromDateInput(String(form.get("dob") ?? ""));

    if (!name) {
      setError("First and last name are required.");
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
          gender,
          dob,
          cnic,
          address,
          memberType,
          addOns: selectedAddOns,
          photoStorageId,
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
          gender,
          dob,
          cnic,
          address,
          memberType,
          addOns: selectedAddOns,
          photoStorageId,
          regFeeCents: 200_00, // Rs 200 registration fee collected at sign-up
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

  function toggleAddOn(name: string) {
    setSelectedAddOns((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name],
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="tracking-tight">
          {isEdit ? "Edit member" : "Add member"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the profile, plan, status or contact details."
            : "The intake sheet: who they are, how to reach them, and what they bought."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-6 py-5">
        {/* ---------------------------------------------- personal info */}
        <Fieldset title="Personal information">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted"
              aria-label="Upload profile photo"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-6 text-muted-foreground" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin text-white" />
                ) : (
                  <Camera className="size-4 text-white" />
                )}
              </span>
            </button>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shadow-none"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="size-3.5" />
                  Upload photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shadow-none"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="size-3.5" />
                  Camera
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                JPG or PNG, up to 5MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handlePhoto(file);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handlePhoto(file);
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="member-first">First name *</Label>
              <Input
                id="member-first"
                name="firstName"
                defaultValue={member ? firstName : ""}
                placeholder="First name"
                autoComplete="off"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-last">Last name *</Label>
              <Input
                id="member-last"
                name="lastName"
                defaultValue={member ? restName.join(" ") : ""}
                placeholder="Last name"
                autoComplete="off"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-dob">Date of birth *</Label>
              <Input
                id="member-dob"
                name="dob"
                type="date"
                defaultValue={toDateInput(member?.dob)}
                required={!isEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-gender">Gender *</Label>
              <Select
                value={gender ?? ""}
                onValueChange={(value) =>
                  setGender(value === "male" ? "male" : "female")
                }
              >
                <SelectTrigger id="member-gender" className="w-full">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-cnic">CNIC number</Label>
              <Input
                id="member-cnic"
                name="cnic"
                defaultValue={member?.cnic}
                placeholder="35202-1234567-8"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="member-type">Member type</Label>
              <Select
                value={memberType}
                onValueChange={(value) =>
                  setMemberType(value === "staff" ? "staff" : "member")
                }
              >
                <SelectTrigger id="member-type" className="w-full">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">New member</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="member-code">Member ID</Label>
              <Input
                id="member-code"
                value={existingCode ?? "Assigned automatically"}
                readOnly
                className="font-mono"
                placeholder="Auto-assigned"
              />
            </div>
          </div>
        </Fieldset>

        {/* --------------------------------------------- contact info */}
        <Fieldset title="Contact information">
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
              <Label htmlFor="member-phone">Phone number *</Label>
              <div className="flex">
                <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 font-mono text-sm text-muted-foreground">
                  +92
                </span>
                <Input
                  id="member-phone"
                  name="phone"
                  defaultValue={member?.phone?.replace(/^\+92\s?/, "")}
                  placeholder="300 1234567"
                  autoComplete="off"
                  className="rounded-l-none"
                  required={!isEdit}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="member-address">Address</Label>
              <Input
                id="member-address"
                name="address"
                defaultValue={member?.address}
                placeholder="Street, area, city"
                autoComplete="off"
              />
            </div>
          </div>
        </Fieldset>

        {/* ------------------------------------------ membership info */}
        <Fieldset title="Membership details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="member-plan">Package *</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger id="member-plan" className="w-full">
                  <SelectValue placeholder="Pick a package" />
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

            {!isEdit && (
              <div className="grid gap-2 sm:col-span-2">
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
        </Fieldset>

        {/* -------------------------------------------------- add-ons */}
        <Fieldset title="Add-ons">
          {addOns === undefined ? (
            <p className="text-sm text-muted-foreground">Loading add-ons…</p>
          ) : addOns.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No add-ons defined yet — create them under Packages → Add-ons.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {addOns.items.map((addOn) => {
                const selected = selectedAddOns.includes(addOn.name);
                return (
                  <button
                    key={addOn._id}
                    type="button"
                    onClick={() => toggleAddOn(addOn.name)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {addOn.name} · {formatMoney(addOn.priceCents)}
                  </button>
                );
              })}
            </div>
          )}
        </Fieldset>

        {/* ---------------------------------------------------- note */}
        <div className="grid gap-2">
          <Label htmlFor="member-note">Note</Label>
          <Textarea
            id="member-note"
            name="note"
            defaultValue={member?.note}
            placeholder="Injuries, goals, anything the desk should know"
            rows={2}
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
        <Button type="submit" disabled={saving || uploading}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Add member"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Fieldset({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-1">{title}</legend>
      {children}
    </fieldset>
  );
}
