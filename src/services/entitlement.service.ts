import { getPool } from "@/lib/db";
import { Entitlement, EntitlementWithBundle, Bundle } from "@/types/api";

export async function getUserEntitlements(userId: string): Promise<EntitlementWithBundle[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT e.*,
            b.id AS b_id, b.title, b.description, b.price, b.metadata_url, b.created_at AS b_created_at
     FROM entitlements e
     JOIN bundles b ON b.id = e.bundle_id
     WHERE e.user_id = $1
     ORDER BY e.purchased_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    bundle_id: row.bundle_id,
    purchased_at: row.purchased_at,
    bundle: {
      id: row.b_id,
      title: row.title,
      description: row.description,
      price: row.price,
      metadata_url: row.metadata_url,
      created_at: row.b_created_at,
    } as Bundle,
  }));
}

export async function userOwnsBundle(userId: string, bundleId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT 1 FROM entitlements WHERE user_id = $1 AND bundle_id = $2 LIMIT 1",
    [userId, bundleId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function createEntitlement(
  userId: string,
  bundleId: string
): Promise<Entitlement> {
  const pool = getPool();

  const existing = await pool.query(
    "SELECT * FROM entitlements WHERE user_id = $1 AND bundle_id = $2",
    [userId, bundleId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const result = await pool.query<Entitlement>(
    "INSERT INTO entitlements (user_id, bundle_id) VALUES ($1, $2) RETURNING *",
    [userId, bundleId]
  );
  return result.rows[0];
}
