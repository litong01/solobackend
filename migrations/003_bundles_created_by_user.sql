-- Allow bundles to be owned by a user (creator).
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bundles_created_by_user_id ON bundles(created_by_user_id);
