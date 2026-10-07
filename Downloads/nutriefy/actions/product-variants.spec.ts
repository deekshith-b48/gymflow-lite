import { PGlite } from "@electric-sql/pglite";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "../drizzle/schema";
import {
  createProductVariantInputSchema,
  updateProductVariantInputSchema,
} from "../server/lib/product-variant-schemas";

const databaseState = vi.hoisted(() => ({ db: null as any }));

vi.mock("../server/db.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db.js")>();
  return { ...actual, getDb: () => databaseState.db };
});

vi.mock("@agent-native/core/server", () => ({
  getAppConfig: () => ({ access: { bootstrapAdmins: ["admin@example.test"] } }),
}));

import createProductVariant from "./create-product-variant";
import listProductVariants from "./list-product-variants";
import updateProductVariant from "./update-product-variant";
import adjustVariantInventory from "./adjust-variant-inventory";

const adminContext = { userEmail: "admin@example.test" };
let client: PGlite;
let db: ReturnType<typeof drizzle>;

async function createProduct(id = crypto.randomUUID()) {
  await db.insert(schema.products).values({
    id,
    name: "Test Product",
    slug: `test-${id}`,
    sku: `PRODUCT-${id}`,
    priceInPaise: 10000,
  });
  return id;
}

const variantInput = (productId: string, sku = "VARIANT-1") => ({
  productId,
  name: "Chocolate · 1 kg",
  sku,
  attributes: { flavor: "Chocolate", weight: "1 kg" },
  priceInPaise: 12000,
  salePriceInPaise: 10000,
  quantity: 4,
  lowStockThreshold: 2,
  status: "ACTIVE" as const,
  sortOrder: 0,
});

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });
  databaseState.db = db;
  await migrate(db, { migrationsFolder: "drizzle/migrations" });
  vi.stubGlobal("fail", (message: string, options: Record<string, unknown>) => {
    throw Object.assign(new Error(message), options);
  });
});

beforeEach(async () => {
  await client.exec(
    `TRUNCATE TABLE audit_logs, inventory_transactions, variant_inventory, product_variants, inventory, products, categories CASCADE`,
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await client.close();
});

describe("product variant actions", () => {
  it("denies unauthenticated and non-admin requests", async () => {
    const productId = await createProduct();
    const input = variantInput(productId);

    await expect(createProductVariant.run(input)).rejects.toMatchObject({
      errorCode: "sign_in_required",
    });
    await expect(
      createProductVariant.run(input, { userEmail: "customer@example.test" }),
    ).rejects.toMatchObject({ errorCode: "admin_required" });
    await expect(
      listProductVariants.run(
        { productId },
        { userEmail: "customer@example.test" },
      ),
    ).rejects.toMatchObject({ errorCode: "admin_required" });
  });

  it("creates a variant, opening stock, immutable ledger entry, and audit record", async () => {
    const productId = await createProduct();
    const created = await createProductVariant.run(
      variantInput(productId),
      adminContext,
    );

    expect(created).toMatchObject({ productId, sku: "VARIANT-1" });
    const [variant] = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, created.id));
    expect(variant.attributes).toEqual({ flavor: "Chocolate", weight: "1 kg" });

    const [inventory] = await db
      .select()
      .from(schema.variantInventory)
      .where(eq(schema.variantInventory.variantId, created.id));
    expect(inventory.quantity).toBe(4);

    const ledger = await db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.variantId, created.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      productId,
      quantityChange: 4,
      quantityAfter: 4,
      type: "RESTOCK",
    });

    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, created.id));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorEmail: "admin@example.test",
      action: "PRODUCT_VARIANT_CREATED",
    });
  });

  it("rejects duplicate SKUs and nonexistent parent products", async () => {
    const productId = await createProduct();
    await createProductVariant.run(variantInput(productId), adminContext);
    await expect(
      createProductVariant.run(variantInput(productId), adminContext),
    ).rejects.toMatchObject({ errorCode: "duplicate_variant_sku" });
    await expect(
      createProductVariant.run(
        variantInput(crypto.randomUUID(), "ORPHAN-SKU"),
        adminContext,
      ),
    ).rejects.toMatchObject({ errorCode: "product_not_found" });
  });

  it("rejects invalid prices and negative opening stock at validation", () => {
    const productId = crypto.randomUUID();
    expect(
      createProductVariantInputSchema.safeParse({
        ...variantInput(productId),
        priceInPaise: 0,
      }).success,
    ).toBe(false);
    expect(
      createProductVariantInputSchema.safeParse({
        ...variantInput(productId),
        priceInPaise: 10000,
        salePriceInPaise: 10000,
      }).success,
    ).toBe(false);
    expect(
      createProductVariantInputSchema.safeParse({
        ...variantInput(productId),
        quantity: -1,
      }).success,
    ).toBe(false);
    expect(
      updateProductVariantInputSchema.safeParse({
        id: crypto.randomUUID(),
        productId,
        priceInPaise: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects cross-product variant updates and reads of missing products", async () => {
    const productId = await createProduct();
    const otherProductId = await createProduct();
    const created = await createProductVariant.run(
      variantInput(productId),
      adminContext,
    );

    await expect(
      updateProductVariant.run(
        {
          id: created.id,
          productId: otherProductId,
          name: "Wrong parent",
        },
        adminContext,
      ),
    ).rejects.toMatchObject({ errorCode: "variant_not_found" });
    await expect(
      listProductVariants.run({ productId: crypto.randomUUID() }, adminContext),
    ).rejects.toMatchObject({ errorCode: "product_not_found" });
  });

  it("adjusts stock atomically and writes variant-linked ledger and audit rows", async () => {
    const productId = await createProduct();
    const created = await createProductVariant.run(
      variantInput(productId),
      adminContext,
    );

    const result = await adjustVariantInventory.run(
      {
        productId,
        variantId: created.id,
        type: "ADJUSTMENT",
        quantityChange: -2,
        note: "Damaged units",
      },
      adminContext,
    );
    expect(result.quantity).toBe(2);

    const [inventory] = await db
      .select()
      .from(schema.variantInventory)
      .where(eq(schema.variantInventory.variantId, created.id));
    expect(inventory.quantity).toBe(2);

    const [transaction] = await db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.variantId, created.id))
      .orderBy(desc(schema.inventoryTransactions.createdAt));
    expect(transaction).toMatchObject({
      productId,
      quantityChange: -2,
      quantityAfter: 2,
      type: "ADJUSTMENT",
    });
    await expect(
      db
        .update(schema.inventoryTransactions)
        .set({ note: "Attempted ledger edit" })
        .where(eq(schema.inventoryTransactions.id, transaction.id)),
    ).rejects.toThrow(); // append-only protection enforced by database trigger

    const audits = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, created.id));
    expect(audits).toHaveLength(2);
    expect(audits[1].action).toBe("VARIANT_INVENTORY_CHANGED");

    await expect(
      adjustVariantInventory.run(
        {
          productId,
          variantId: created.id,
          type: "ADJUSTMENT",
          quantityChange: -3,
        },
        adminContext,
      ),
    ).rejects.toMatchObject({ errorCode: "insufficient_inventory" });

    const otherProductId = await createProduct();
    await expect(
      adjustVariantInventory.run(
        {
          productId: otherProductId,
          variantId: created.id,
          type: "ADJUSTMENT",
          quantityChange: 1,
        },
        adminContext,
      ),
    ).rejects.toMatchObject({ errorCode: "variant_not_found" });
  });

  it("rolls back variant, stock, and ledger writes when audit insertion fails", async () => {
    const productId = await createProduct();
    await client.exec(
      `CREATE TRIGGER variant_test_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation()`,
    );

    await expect(
      createProductVariant.run(
        variantInput(productId, "ROLLBACK-SKU"),
        adminContext,
      ),
    ).rejects.toThrow();

    await client.exec(`DROP TRIGGER variant_test_audit_failure ON audit_logs`);
    expect(await db.select().from(schema.productVariants)).toHaveLength(0);
    expect(await db.select().from(schema.variantInventory)).toHaveLength(0);
    expect(await db.select().from(schema.inventoryTransactions)).toHaveLength(0);
    expect(await db.select().from(schema.auditLogs)).toHaveLength(0);
  });
});
