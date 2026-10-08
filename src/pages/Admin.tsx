import {
  CatalogItemDialog,
} from "@/components/CatalogItemDialog";
import { SessionDialog } from "@/components/SessionDialog";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  categoryTone,
  formatMoney,
  formatRecency,
  orderStatusClass,
  postKindLabel,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  Loader2,
  Package,
  Rss,
  ScanLine,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const MANAGE = [
  {
    to: "/dashboard/catalog",
    label: "Catalog items",
    hint: "Create, price, publish and archive everything you sell.",
    icon: Package,
  },
  {
    to: "/dashboard/schedule",
    label: "Sessions",
    hint: "Add or remove bookable times and watch seats fill.",
    icon: CalendarClock,
  },
  {
    to: "/dashboard/members",
    label: "Members",
    hint: "Roster, plans, dues, contact details and notes.",
    icon: Users,
  },
  {
    to: "/dashboard/check-ins",
    label: "Check-ins",
    hint: "The front-desk log for today and the week behind it.",
    icon: ScanLine,
  },
  {
    to: "/dashboard/feed",
    label: "Content",
    hint: "Announcements, uploads and drafts waiting to publish.",
    icon: Rss,
  },
];

/** The admin area: orders, content moderation and every management surface. */
export default function Admin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const summary = useQuery(api.overview.summary);
  const orders = useQuery(api.orders.list, { status: statusFilter });
  const posts = useQuery(api.posts.list, { includeDrafts: true });
  const catalog = useQuery(api.catalog.list, {});

  const setOrderStatus = useMutation(api.orders.setStatus);
  const togglePublish = useMutation(api.posts.togglePublish);
  const removePost = useMutation(api.posts.remove);

  async function handleOrderStatus(
    orderId: Id<"orders">,
    status: "paid" | "refunded" | "cancelled",
    itemName: string,
  ) {
    setBusyId(orderId);
    try {
      await setOrderStatus({ orderId, status });
      toast.success(`${itemName} marked ${status}`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update the order.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePost(postId: Id<"posts">, title: string) {
    setBusyId(postId);
    try {
      await togglePublish({ postId });
      toast.success(`${title} visibility updated`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update the post.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemovePost(postId: Id<"posts">, title: string) {
    setBusyId(postId);
    try {
      await removePost({ postId });
      toast(`${title} deleted`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not delete the post.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="eyebrow">Control</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">Admin area</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Revenue, moderation and every management surface for this workspace.
        </p>
      </header>

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Collected"
          value={summary ? formatMoney(summary.revenue.revenue30dCents) : "—"}
          hint="Last 30 days"
        />
        <Stat
          label="Awaiting collection"
          value={summary ? formatMoney(summary.revenue.pendingCents) : "—"}
          hint="Pending orders"
        />
        <Stat
          label="Dues outstanding"
          value={summary ? formatMoney(summary.roster.duesOutstandingCents) : "—"}
          hint="Across the roster"
        />
        <Stat
          label="Content"
          value={
            summary
              ? `${summary.content.published}/${summary.content.published + summary.content.drafts}`
              : "—"
          }
          hint="Published posts"
        />
      </div>

      <Tabs defaultValue="orders" className="flex flex-col gap-5">
        <TabsList className="w-full justify-start sm:w-auto">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {["all", "paid", "pending", "refunded", "cancelled"].map((option) => (
              <Button
                key={option}
                size="sm"
                variant={statusFilter === option ? "default" : "outline"}
                className="shadow-none capitalize"
                onClick={() => setStatusFilter(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          {orders === undefined ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : orders.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
              No orders with that status.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {orders.items.map((order) => (
                <li
                  key={order._id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {order.itemName}
                    </span>
                    <span className="figure mt-0.5 block text-[11px] text-muted-foreground">
                      {order.reference} · {order.method.replace("_", " ")} ·{" "}
                      {formatRecency(order.createdAt)}
                    </span>
                  </span>
                  <span className="figure text-sm">
                    {formatMoney(order.amountCents)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                      orderStatusClass(order.status),
                    )}
                  >
                    {order.status}
                  </span>
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={busyId === order._id}
                      onClick={() =>
                        handleOrderStatus(order._id, "paid", order.itemName)
                      }
                    >
                      Mark paid
                    </Button>
                  )}
                  {order.status === "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shadow-none"
                      disabled={busyId === order._id}
                      onClick={() =>
                        handleOrderStatus(order._id, "refunded", order.itemName)
                      }
                    >
                      Refund
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="content" className="flex flex-col gap-4">
          {posts === undefined ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : posts.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
              Nothing to moderate yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {posts.items.map((post) => (
                <li
                  key={post._id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                      categoryTone(post.kind),
                    )}
                  >
                    {postKindLabel(post.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {post.title}
                    </span>
                    <span className="figure mt-0.5 block text-[11px] text-muted-foreground">
                      {post.authorName} · {formatRecency(post._creationTime)} ·
                      {post.published ? " live" : " draft"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shadow-none"
                    disabled={busyId === post._id}
                    onClick={() => handleTogglePost(post._id, post.title)}
                  >
                    {post.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${post.title}`}
                    disabled={busyId === post._id}
                    onClick={() => handleRemovePost(post._id, post.title)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="workspace" className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreatingItem(true)}>
              <Package className="size-4" />
              New catalog item
            </Button>
            <Button
              variant="outline"
              className="shadow-none"
              onClick={() => setCreatingSession(true)}
            >
              <CalendarClock className="size-4" />
              New session
            </Button>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {MANAGE.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="group bg-card px-5 py-4 transition-colors hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <entry.icon className="size-4 text-primary" />
                  <span className="text-sm font-medium">{entry.label}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {entry.hint}
                </span>
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Every operator in this workspace currently has full admin rights.
            Roles and per-staff permissions are the next thing to add.
          </p>
        </TabsContent>
      </Tabs>

      <CatalogItemDialog open={creatingItem} onOpenChange={setCreatingItem} />
      <SessionDialog
        open={creatingSession}
        onOpenChange={setCreatingSession}
        catalogOptions={
          catalog?.items.map((item) => ({ _id: item._id, name: item.name })) ??
          []
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="figure mt-1.5 text-xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
