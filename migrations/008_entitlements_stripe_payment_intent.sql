-- Store Stripe PaymentIntent ID on entitlements so we can revoke access when a refund is issued.
ALTER TABLE entitlements
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_entitlements_stripe_payment_intent_id
ON entitlements(stripe_payment_intent_id)
WHERE stripe_payment_intent_id IS NOT NULL;

COMMENT ON COLUMN entitlements.stripe_payment_intent_id IS 'Stripe PaymentIntent ID for this purchase. Used to revoke entitlement when charge.refunded (full refund).';
