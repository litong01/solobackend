import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getEntitlement, revokeEntitlementByPaymentIntentId } from "@/services/entitlement.service";

/** Restocking fee: percentage + fixed cents (like Stripe's fee), capped so the customer gets at least (100 - max_percent)% back on small sales. */
function getRestockingFeeCents(chargeAmountCents: number): number {
  const percent = parseFloat(process.env.STRIPE_RESTOCKING_FEE_PERCENT ?? "2.9");
  const fixedCents = parseInt(process.env.STRIPE_RESTOCKING_FEE_FIXED_CENTS ?? "30", 10);
  const maxPercentOfCharge = parseFloat(process.env.STRIPE_RESTOCKING_FEE_MAX_PERCENT ?? "50");

  const percentFee = Math.round((chargeAmountCents * (Number.isFinite(percent) ? percent : 2.9)) / 100);
  const rawFee = percentFee + (Number.isFinite(fixedCents) ? fixedCents : 30);
  const maxFeeByRule = Math.round(
    (chargeAmountCents * (Number.isFinite(maxPercentOfCharge) ? maxPercentOfCharge : 50)) / 100
  );
  const fee = Math.min(rawFee, maxFeeByRule);
  return Math.min(Math.max(0, fee), chargeAmountCents - 1);
}

/** Refund allowed only within this many days after purchase. */
const REFUND_WINDOW_DAYS = parseInt(process.env.STRIPE_REFUND_WINDOW_DAYS ?? "7", 10) || 7;

/**
 * Create a refund for a purchase, minus a restocking fee so the platform doesn't absorb Stripe's non-refunded processing fee.
 * Refunds are only allowed within REFUND_WINDOW_DAYS (default 7) of the purchase — enforced server-side so it cannot be bypassed.
 * For Connect destination charges, sets reverse_transfer=true and refund_application_fee=true (proportional to the refund amount).
 * Access is revoked immediately after the refund is created.
 */
export async function createRefundForPurchase(
  userId: string,
  bundleId: string,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
): Promise<{ refund: Stripe.Refund; restocking_fee_cents: number }> {
  const entitlement = await getEntitlement(userId, bundleId);
  if (!entitlement) {
    throw new Error("No purchase found for this user and bundle");
  }

  const purchasedAt = new Date(entitlement.purchased_at).getTime();
  const now = Date.now();
  const windowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (now - purchasedAt > windowMs) {
    throw new Error(
      `Refund window has closed. Refunds are only available within ${REFUND_WINDOW_DAYS} days of purchase.`
    );
  }

  const paymentIntentId = entitlement.stripe_payment_intent_id;
  if (!paymentIntentId) {
    throw new Error(
      "This purchase cannot be refunded via API (missing payment reference). Use Stripe Dashboard."
    );
  }

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;
  if (!chargeId) {
    throw new Error("No charge found for this payment");
  }

  const charge = await stripe.charges.retrieve(chargeId);
  const chargeAmountCents = charge.amount ?? 0;
  const restockingFeeCents = getRestockingFeeCents(chargeAmountCents);
  const refundAmountCents = chargeAmountCents - restockingFeeCents;

  const refund = await stripe.refunds.create({
    charge: chargeId,
    amount: refundAmountCents,
    reason: reason ?? "requested_by_customer",
    reverse_transfer: true,
    refund_application_fee: true,
  });

  await revokeEntitlementByPaymentIntentId(paymentIntentId);
  return { refund, restocking_fee_cents: restockingFeeCents };
}
