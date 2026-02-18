import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createEntitlement } from "@/services/entitlement.service";
import { findOrCreateUser } from "@/services/user.service";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "bad_request", message: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "bad_request", message: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const bundleId = session.metadata?.bundle_id;

    if (!userId || !bundleId) {
      console.error("Webhook missing metadata:", { userId, bundleId });
      return NextResponse.json(
        { error: "bad_request", message: "Missing metadata in checkout session" },
        { status: 400 }
      );
    }

    try {
      await findOrCreateUser(userId, session.customer_email || "");
      await createEntitlement(userId, bundleId);
      console.log(`Entitlement created: user=${userId} bundle=${bundleId}`);
    } catch (err) {
      console.error("Error processing webhook:", err);
      return NextResponse.json(
        { error: "server_error", message: "Failed to process purchase" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
