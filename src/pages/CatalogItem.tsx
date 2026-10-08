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
import {
  CatalogItemDialog,
  type EditableItem,
} from "@/components/CatalogItemDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  cadenceLabel,
  categoryTone,
  catalogStatusClass,
  catalogStatusLabel,
  formatMoney,
  formatPrice,
  formatShortDate,
  formatTime,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CreditCard,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

/**
 * One catalog item: what it includes, the times members can book, and the
 * checkout that turns a price into a recorded order.
 */
export default function CatalogItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const data = useQuery(
    api.catalog.get,
    itemId ? { itemId: itemId as Id<"catalogItems"> } : "skip",
  );

  const checkout = useMutation(api.orders.checkout);
  const updateItem = useMutation(api.catalog.update);
  const removeItem = useMutation(api.catalog.remove);
  const book = useMutation(api.sessions.book);
  const cancelBooking = useMutation(api.sessions.cancelBooking);

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
        <p className="text-sm font-medium">That item is gone</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It was deleted from the catalog, or the link is out of date.
        </p>
        <Button asChild variant="outline" className="mt-5 shadow-none">
          <Link to="/dashboard/catalog">Back to the catalog</Link>
        </Button>
      </div>
    );
  }

  const { item, sessions, sales } = data;

  async function handleCheckout(method: "sandbox_card" | "desk") {
    setBusy(method);
    try {
      const result = await checkout({ itemId: item._id, method });
      if (result.status === "paid") {
        toast.success(`Paid ${formatMoney(result.amountCents)}`, {
          description: `${result.itemName} · order ${result.orderId.slice(-6).toUpperCase()}`,
        });
      } else {
        toast("Order recorded", {
          description: `${item.name} left pending for the desk to collect.`,
        });
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Checkout failed.",
      );
    } finally {
      setBusy(null);
    }
  }

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

  async function handleCancelBooking(bookingId: Id<"bookings">, title: string) {
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

  async function handleToggleStatus() {
    const next = item.status === "published" ? "draft" : "published";
    try {
      await updateItem({ itemId: item._id, status: next });
      toast.success(`${item.name} is now ${catalogStatusLabel(next).toLowerCase()}`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update status.",
      );
    }
  }

  async function handleDelete() {
    try {
      await removeItem({ itemId: item._id });
      toast(`${item.name} removed from the catalog`);
      navigate("/dashboard/catalog");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove item.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <Link
        to="/dashboard/catalog"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Catalog
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
              categoryTone(item.category),
            )}
          >
            {item.category}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-[10px]",
              catalogStatusClass(item.status),
            )}
          >
            {catalogStatusLabel(item.status)}
          </span>
          <span className="figure text-[11px] text-muted-foreground">
            /{item.slug}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {item.name}
        </h1>
        {item.tagline && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {item.tagline}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2 shadow-none" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button variant="outline" className="shadow-none" onClick={handleToggleStatus}>
            {item.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button
            variant="ghost"
            className="ml-auto gap-2 text-muted-foreground hover:text-rose-300"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </motion.header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <p className="eyebrow">What&apos;s included</p>
            </div>
            {item.features.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No inclusions listed yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {item.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    <Check className="size-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            {item.description && (
              <p className="border-t border-border px-5 py-4 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="eyebrow">Bookable times</p>
              <Link
                to="/dashboard/schedule"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Full schedule
              </Link>
            </div>
            {sessions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                No upcoming times attached to this item yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {sessions.map((session) => (
                  <li
                    key={session._id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-secondary">
                      <span className="figure text-[10px] leading-none text-muted-foreground">
                        {formatShortDate(session.startsAt).split(" ")[0]}
                      </span>
                      <span className="figure text-xs font-medium leading-tight">
                        {formatShortDate(session.startsAt).split(" ")[1]}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {session.title}
                      </span>
                      <span className="figure mt-0.5 block text-[11px] text-muted-foreground">
                        {formatTime(session.startsAt)} · {session.coach} ·{" "}
                        {session.spotsLeft} of {session.capacity} left
                      </span>
                    </span>
                    {session.bookedByMe && session.myBookingId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shadow-none"
                        disabled={busy === session.myBookingId}
                        onClick={() =>
                          handleCancelBooking(
                            session.myBookingId as Id<"bookings">,
                            session.title,
                          )
                        }
                      >
                        {busy === session.myBookingId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Cancel"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={
                          busy === session._id || session.spotsLeft === 0
                        }
                        onClick={() => handleBook(session._id, session.title)}
                      >
                        {busy === session._id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : session.spotsLeft === 0 ? (
                          "Full"
                        ) : (
                          <>
                            <CalendarClock className="size-3.5" />
                            Book
                          </>
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <p className="eyebrow">Checkout</p>
            </div>
            <div className="px-5 py-5">
              <p className="figure text-3xl font-medium">
                {formatPrice(item.priceCents, item.cadence)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Billed {cadenceLabel(item.cadence).toLowerCase()} ·{" "}
                {item.capacity} seats per session
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  disabled={busy !== null || item.status !== "published"}
                  onClick={() => handleCheckout("sandbox_card")}
                >
                  {busy === "sandbox_card" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Pay now
                </Button>
                <Button
                  variant="outline"
                  className="shadow-none"
                  disabled={busy !== null || item.status !== "published"}
                  onClick={() => handleCheckout("desk")}
                >
                  {busy === "desk" && <Loader2 className="size-4 animate-spin" />}
                  Collect at the desk
                </Button>
              </div>

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                {item.status === "published"
                  ? "No payment gateway is connected yet, so card payments settle in the sandbox and desk payments stay pending until collected."
                  : "Publish this item before selling it."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
              <div className="bg-card px-5 py-3">
                <p className="eyebrow">Orders</p>
                <p className="figure mt-1 text-lg font-medium">
                  {sales.orders}
                </p>
              </div>
              <div className="bg-card px-5 py-3">
                <p className="eyebrow">Collected</p>
                <p className="figure mt-1 text-lg font-medium">
                  {formatMoney(sales.paidCents)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="eyebrow">Members on this item</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              {item.capacity} seats configured per session
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Attach this item to sessions from the schedule to open bookings.
            </p>
          </section>
        </div>
      </div>

      <CatalogItemDialog
        open={editing}
        onOpenChange={setEditing}
        item={item as EditableItem}
      />

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its sessions and their bookings are deleted too. Recorded orders
              stay on the books.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep item</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
