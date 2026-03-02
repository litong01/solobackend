-- Store Stripe Connect Express account ID for bundle creators who want to receive payouts.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id
ON users(stripe_connect_account_id)
WHERE stripe_connect_account_id IS NOT NULL;

COMMENT ON COLUMN users.stripe_connect_account_id IS 'Stripe Connect Express account ID (acct_xxx). When set and onboarding complete, bundle sales are paid to this account; platform keeps application fee.';
