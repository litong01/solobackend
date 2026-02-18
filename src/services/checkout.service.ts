import { getStripe } from "@/lib/stripe";
import { Bundle } from "@/types/api";

export async function createCheckoutSession(
  bundle: Bundle,
  userId: string,
  userEmail: string
): Promise<string> {
  const stripe = getStripe();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: userEmail,
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
    success_url: `${siteUrl}/library?purchase=success&bundle=${bundle.id}`,
    cancel_url: `${siteUrl}/bundles/${bundle.id}?purchase=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}
