import { getPool } from "@/lib/db";
import { Entitlement, EntitlementWithBundle, Bundle } from "@/types/api";

/**
 * Returns all bundles the user can access: purchased (entitlements) plus bundles they created.
 * Deduped by bundle_id (purchase wins if both).
 */
export async function getUserEntitlements(userId: string): Promise<EntitlementWithBundle[]> {
  const pool = getPool();

  const [purchasedResult, ownedResult] = await Promise.all([
    pool.query(
      `SELECT e.*,
              b.id AS b_id, b.title, b.description, b.price, b.category, b.metadata_url, b.r2_key, b.created_by_user_id, b.created_at AS b_created_at
       FROM entitlements e
       JOIN bundles b ON b.id = e.bundle_id
       WHERE e.user_id = $1
       ORDER BY e.purchased_at DESC`,
      [userId]
    ),
    pool.query(
      `SELECT id AS b_id, title, description, price, category, metadata_url, r2_key, created_by_user_id, created_at AS b_created_at
       FROM bundles
       WHERE created_by_user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  const byBundleId = new Map<string, EntitlementWithBundle>();

  for (const row of purchasedResult.rows) {
    const bundle = rowToBundle(row);
    byBundleId.set(row.bundle_id, {
      id: row.id,
      user_id: row.user_id,
      bundle_id: row.bundle_id,
      purchased_at: row.purchased_at,
      bundle,
    });
  }

  for (const row of ownedResult.rows) {
    if (byBundleId.has(row.b_id)) continue;
    const bundle = rowToBundle(row);
    byBundleId.set(row.b_id, {
      id: `owned-${row.b_id}`,
      user_id: userId,
      bundle_id: row.b_id,
      purchased_at: row.b_created_at,
      bundle,
    });
  }

  return Array.from(byBundleId.values()).sort(
    (a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
  );
}

function rowToBundle(row: Record<string, unknown>): Bundle {
  return {
    id: row.b_id as string,
    title: row.title as string,
    description: row.description as string,
    price: Number(row.price),
    category: (row.category as string) ?? "",
    metadata_url: row.metadata_url as string | null,
    r2_key: row.r2_key as string | null,
    created_by_user_id: row.created_by_user_id as string | null,
    created_at: row.b_created_at as string,
  };
}

export async function userOwnsBundle(userId: string, bundleId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT 1 FROM entitlements WHERE user_id = $1 AND bundle_id = $2 LIMIT 1",
    [userId, bundleId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/** Get entitlement row for user+bundle (for refund lookup). Returns null if not found. */
export async function getEntitlement(
  userId: string,
  bundleId: string
): Promise<(Entitlement & { stripe_payment_intent_id?: string | null }) | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM entitlements WHERE user_id = $1 AND bundle_id = $2 LIMIT 1",
    [userId, bundleId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    bundle_id: row.bundle_id,
    purchased_at: row.purchased_at,
    stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
  };
}

/** True if the bundle has at least one purchase (entitlement). */
export async function bundleHasPurchases(bundleId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT 1 FROM entitlements WHERE bundle_id = $1 LIMIT 1",
    [bundleId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function createEntitlement(
  userId: string,
  bundleId: string,
  stripePaymentIntentId?: string | null
): Promise<Entitlement & { stripe_payment_intent_id?: string | null }> {
  const pool = getPool();

  const existing = await pool.query(
    "SELECT * FROM entitlements WHERE user_id = $1 AND bundle_id = $2",
    [userId, bundleId]
  );
  if (existing.rows[0]) {
    if (stripePaymentIntentId && !existing.rows[0].stripe_payment_intent_id) {
      await pool.query(
        "UPDATE entitlements SET stripe_payment_intent_id = $1 WHERE user_id = $2 AND bundle_id = $3",
        [stripePaymentIntentId, userId, bundleId]
      );
      return { ...existing.rows[0], stripe_payment_intent_id: stripePaymentIntentId };
    }
    return existing.rows[0] as Entitlement & { stripe_payment_intent_id?: string | null };
  }

  const result = await pool.query<Entitlement & { stripe_payment_intent_id?: string | null }>(
    "INSERT INTO entitlements (user_id, bundle_id, stripe_payment_intent_id) VALUES ($1, $2, $3) RETURNING *",
    [userId, bundleId, stripePaymentIntentId ?? null]
  );
  return result.rows[0];
}

/**
 * Revoke a purchase (delete entitlement) by Stripe PaymentIntent ID.
 * Used when a charge is fully refunded so the buyer loses access.
 */
export async function revokeEntitlementByPaymentIntentId(
  stripePaymentIntentId: string
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "DELETE FROM entitlements WHERE stripe_payment_intent_id = $1 RETURNING id",
    [stripePaymentIntentId]
  );
  return (result.rowCount ?? 0) > 0;
}
