-- User bundles: one zip per bundle in R2 (bundles/YYYYMM/{id}.zip), metadata in DB.
-- Add category (free-form), creator, and R2 pointer; keep metadata_url for legacy seed bundles.

ALTER TABLE bundles ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS r2_key TEXT;

ALTER TABLE bundles ALTER COLUMN metadata_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bundles_created_by_user_id ON bundles(created_by_user_id);
