-- Remove created_by_user_id; ownership is derived from R2 path (user_id/bundle_id/).
ALTER TABLE bundles DROP COLUMN IF EXISTS created_by_user_id;
