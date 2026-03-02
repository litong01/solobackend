-- Saved/wishlist: bundles user added to "My Collection" without purchasing.
CREATE TABLE IF NOT EXISTS user_collection (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bundle_id   UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_user_collection_user_id ON user_collection(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collection_bundle_id ON user_collection(bundle_id);
