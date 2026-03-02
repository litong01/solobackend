import { getPool } from "@/lib/db";
import { User } from "@/types/api";

export async function findOrCreateUser(kindeId: string, email: string): Promise<User> {
  const pool = getPool();

  const existing = await pool.query<User & { stripe_connect_account_id?: string | null }>(
    "SELECT * FROM users WHERE id = $1",
    [kindeId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].email !== email) {
      await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, kindeId]);
    }
    return { ...existing.rows[0], email: existing.rows[0].email };
  }

  const result = await pool.query<User & { stripe_connect_account_id?: string | null }>(
    "INSERT INTO users (id, email) VALUES ($1, $2) RETURNING *",
    [kindeId, email]
  );
  return result.rows[0];
}

export async function getUserById(userId: string): Promise<(User & { stripe_connect_account_id?: string | null }) | null> {
  const pool = getPool();
  const result = await pool.query<User & { stripe_connect_account_id?: string | null }>(
    "SELECT * FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function setUserStripeConnectAccountId(
  userId: string,
  stripeConnectAccountId: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    "UPDATE users SET stripe_connect_account_id = $1 WHERE id = $2",
    [stripeConnectAccountId, userId]
  );
}

export async function getUserByStripeConnectAccountId(
  stripeConnectAccountId: string
): Promise<(User & { stripe_connect_account_id?: string | null }) | null> {
  const pool = getPool();
  const result = await pool.query<User & { stripe_connect_account_id?: string | null }>(
    "SELECT * FROM users WHERE stripe_connect_account_id = $1",
    [stripeConnectAccountId]
  );
  return result.rows[0] ?? null;
}
