import {
  CatalogItemDialog,
  type EditableItem,
} from "@/components/CatalogItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { api } from "@/convex/_generated/api";
import {
  categoryTone,
  catalogStatusClass,
  catalogStatusLabel,
  formatMoney,
  formatPrice,
  CATALOG_STATUS_OPTIONS,
} from "@/lib/gym";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Loader2, Package, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

/**
 * The catalog: everything the business sells. Search and filter on the left of
 * your eye, the item itself one tap away.
 */
export default function Catalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableItem | null>(null);

  const catalog = useQuery(api.catalog.list, { search, category, status });

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
            What you sell
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {catalog
              ? `${catalog.stats.published} published · ${catalog.stats.drafts} drafts · ${catalog.stats.categories} categories`
              : "Loading the catalog…"}
          </p>
        </div>
        <Button className="self-start" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New item
        </Button>
      </header>

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        <Stat
          label="Published"
          value={catalog ? String(catalog.stats.published) : "—"}
        />
        <Stat
          label="Average price"
          value={catalog ? formatMoney(catalog.stats.averagePriceCents) : "—"}
        />
        <Stat
          label="Drafts"
          value={catalog ? String(catalog.stats.drafts) : "—"}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items, tags and inclusions"
            className="pl-9 shadow-none"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={category}
            onValueChange={(value) => value && setCategory(value)}
            variant="outline"
            size="sm"
            className="flex-wrap justify-start"
          >
            <ToggleGroupItem value="all">All categories</ToggleGroupItem>
            {(catalog?.categories ?? []).map((option) => (
              <ToggleGroupItem key={option} value={option}>
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => value && setStatus(value)}
            variant="outline"
            size="sm"
            className="ml-auto flex-wrap justify-start"
          >
            <ToggleGroupItem value="all">Any status</ToggleGroupItem>
            {CATALOG_STATUS_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {catalog === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : catalog.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border bg-card">
            <Package className="size-4 text-primary" />
          </span>
          <p className="mt-4 text-sm font-medium">Nothing in the catalog yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {search || category !== "all" || status !== "all"
              ? "No item matches those filters. Try widening the search."
              : "Add your first membership or class pack and it becomes sellable immediately."}
          </p>
          <Button className="mt-5" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New item
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.items.map((item) => (
            <article
              key={item._id}
              className="flex flex-col rounded-xl border border-border bg-card transition-colors hover:border-foreground/25"
            >
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0">
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
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-tight">
                    {item.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.tagline || "No tagline yet"}
                  </p>
                </div>
                <p className="figure shrink-0 text-lg font-medium">
                  {formatPrice(item.priceCents, item.cadence)}
                </p>
              </div>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5 px-5">
                {item.features.slice(0, 3).map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-xs text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
                {item.features.length > 3 && (
                  <li className="figure text-[11px] text-muted-foreground">
                    +{item.features.length - 3} more included
                  </li>
                )}
              </ul>

              <div className="mt-5 flex items-center gap-2 border-t border-border px-5 py-3">
                <Button asChild size="sm">
                  <Link to={`/dashboard/catalog/${item._id}`}>Open item</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(item as EditableItem)}
                >
                  Edit
                </Button>
                <span className="figure ml-auto text-[11px] text-muted-foreground">
                  {item.capacity} seats
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <CatalogItemDialog open={creating} onOpenChange={setCreating} />
      <CatalogItemDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        item={editing ?? undefined}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className="figure mt-1.5 text-xl font-medium">{value}</p>
    </div>
  );
}
