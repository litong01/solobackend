import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith("sk_test_...") || key === "sk_test_...") {
    throw new Error(
      "STRIPE_SECRET_KEY is missing or still set to placeholder. " +
        "Set it in .env.local (e.g. from Stripe Dashboard → Developers → API keys, Secret key)."
    );
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-04-10",
      typescript: true,
    });
  }
  return stripeInstance;
}
