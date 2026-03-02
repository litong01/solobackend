import { getStripe } from "@/lib/stripe";
import { Bundle } from "@/types/api";
import { getConnectAccountIdForPayout } from "@/services/connect.service";

function isValidEmail(value: string | null | undefined): boolean {
  if (value == null || typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** Platform fee as a percentage of the sale (e.g. 10 = 10%). Used only when paying a Connect creator. */
function getApplicationFeePercent(): number {
  const raw = process.env.STRIPE_APPLICATION_FEE_PERCENT;
  if (raw == null || raw === "") return 10;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 10;
  return n;
}

export async function createCheckoutSession(
  bundle: Bundle,
  userId: string,
  userEmail: string | null | undefined
): Promise<string> {
  const stripe = getStripe();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const amountCents = Math.round(bundle.price * 100);

  // When the bundle has a creator with Stripe Connect set up, send funds to them and keep a platform fee.
  const creatorAccountId =
    bundle.created_by_user_id != null
      ? await getConnectAccountIdForPayout(bundle.created_by_user_id)
      : null;

  const paymentIntentData: {
    application_fee_amount?: number;
    transfer_data?: { destination: string };
  } = {};
  if (creatorAccountId != null && creatorAccountId !== "") {
    const feePercent = getApplicationFeePercent();
    paymentIntentData.application_fee_amount = Math.round(
      (amountCents * feePercent) / 100
    );
    paymentIntentData.transfer_data = { destination: creatorAccountId };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    ...(isValidEmail(userEmail) && { customer_email: userEmail!.trim() }),
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: bundle.title,
            description: bundle.description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    ...(Object.keys(paymentIntentData).length > 0 && {
      payment_intent_data: paymentIntentData,
    }),
    metadata: {
      user_id: userId,
      bundle_id: bundle.id,
    },
    success_url: `${siteUrl}/library?purchase=success&bundle=${bundle.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/bundles/${bundle.id}?purchase=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}
