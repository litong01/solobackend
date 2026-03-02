import { getStripe } from "@/lib/stripe";
import { Bundle } from "@/types/api";

function isValidEmail(value: string | null | undefined): boolean {
  if (value == null || typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export async function createCheckoutSession(
  bundle: Bundle,
  userId: string,
  userEmail: string | null | undefined
): Promise<string> {
  const stripe = getStripe();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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
          unit_amount: Math.round(bundle.price * 100),
        },
        quantity: 1,
      },
    ],
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
