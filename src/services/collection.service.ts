import { getPool } from "@/lib/db";
import { listBundlesByUser } from "@/services/bundle.service";
import { getUserEntitlements } from "@/services/entitlement.service";
import type { Bundle, CollectionItem, CollectionItemType } from "@/types/api";

/** Add a bundle to user's collection (saved/wishlist). Idempotent. */
export async function addToCollection(
  userId: string,
  bundleId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_collection (user_id, bundle_id) VALUES ($1, $2)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, bundleId]
  );
}

/** Remove a bundle from user's saved collection. */
export async function removeFromCollection(
  userId: string,
  bundleId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM user_collection WHERE user_id = $1 AND bundle_id = $2",
    [userId, bundleId]
  );
}

/** True if the user has this bundle in their saved (wishlist) collection. */
export async function isInSavedCollection(
  userId: string,
  bundleId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT 1 FROM user_collection WHERE user_id = $1 AND bundle_id = $2 LIMIT 1",
    [userId, bundleId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/** Remove from user_collection when user purchases (so it doesn't appear twice). */
export async function removeSavedOnPurchase(
  userId: string,
  bundleId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM user_collection WHERE user_id = $1 AND bundle_id = $2",
    [userId, bundleId]
  );
}

function rowToBundle(row: Record<string, unknown>): Bundle {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    category: (row.category as string) ?? "",
    metadata_url: row.metadata_url as string | null,
    r2_key: row.r2_key as string | null,
    created_by_user_id: row.created_by_user_id as string | null,
    created_at: row.created_at as string,
  } as Bundle;
}

/**
 * Merged "My Collection" list: purchased + owned + saved. Each bundle appears
 * at most once; priority: purchased > owned > saved.
 */
export async function getCollectionForUser(userId: string): Promise<CollectionItem[]> {
  const pool = getPool();
  const byBundleId = new Map<string, { item: CollectionItem; priority: number }>();

  function add(
    bundle: Bundle,
    type: CollectionItemType,
    priority: number,
    purchased_at?: string,
    added_at?: string
  ) {
    const existing = byBundleId.get(bundle.id);
    if (existing && existing.priority <= priority) return;
    const purchased = type === "purchased";
    const unlocked = type === "purchased" || type === "owned";
    byBundleId.set(bundle.id, {
      item: { bundle, type, purchased, unlocked, purchased_at, added_at },
      priority,
    });
  }

  const [entitlements, ownedBundles, savedRows] = await Promise.all([
    getUserEntitlements(userId),
    listBundlesByUser(userId),
    pool.query<{ bundle_id: string; added_at: string }>(
      "SELECT bundle_id, added_at FROM user_collection WHERE user_id = $1",
      [userId]
    ),
  ]);

  for (const ent of entitlements) {
    add(ent.bundle, "purchased", 3, ent.purchased_at);
  }
  for (const b of ownedBundles) {
    add(b, "owned", 2);
  }

  for (const row of savedRows.rows) {
    if (byBundleId.has(row.bundle_id)) continue;
    const bundleResult = await pool.query(
      "SELECT * FROM bundles WHERE id = $1",
      [row.bundle_id]
    );
    const bundleRow = bundleResult.rows[0];
    if (bundleRow) {
      add(rowToBundle(bundleRow), "saved", 1, undefined, row.added_at);
    }
  }

  const items = Array.from(byBundleId.values()).map((x) => x.item);
  items.sort((a, b) => {
    const at = new Date(a.purchased_at ?? a.added_at ?? a.bundle.created_at).getTime();
    const bt = new Date(b.purchased_at ?? b.added_at ?? b.bundle.created_at).getTime();
    return bt - at;
  });
  return items;
}
