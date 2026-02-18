import { getPool } from "@/lib/db";
import { User } from "@/types/api";

export async function findOrCreateUser(kindeId: string, email: string): Promise<User> {
  const pool = getPool();

  const existing = await pool.query<User>(
    "SELECT * FROM users WHERE id = $1",
    [kindeId]
  );

  if (existing.rows[0]) {
    if (existing.rows[0].email !== email) {
      await pool.query("UPDATE users SET email = $1 WHERE id = $2", [email, kindeId]);
    }
    return { ...existing.rows[0], email };
  }

  const result = await pool.query<User>(
    "INSERT INTO users (id, email) VALUES ($1, $2) RETURNING *",
    [kindeId, email]
  );
  return result.rows[0];
}
