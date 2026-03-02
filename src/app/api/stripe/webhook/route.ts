import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createEntitlement, revokeEntitlementByPaymentIntentId } from "@/services/entitlement.service";
import { removeSavedOnPurchase } from "@/services/collection.service";
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
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      await createEntitlement(userId, bundleId, paymentIntentId);
      await removeSavedOnPurchase(userId, bundleId);
      console.log(`Entitlement created: user=${userId} bundle=${bundleId}`);
    } catch (err) {
      console.error("Error processing webhook:", err);
      return NextResponse.json(
        { error: "server_error", message: "Failed to process purchase" },
        { status: 500 }
      );
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentIntentId) {
      console.warn("charge.refunded: no payment_intent on charge", charge.id);
      return NextResponse.json({ received: true });
    }
    // Only revoke access when the charge is fully refunded
    const amountRefunded = charge.amount_refunded ?? 0;
    const amountCharged = charge.amount ?? 0;
    const isFullRefund = amountCharged > 0 && amountRefunded >= amountCharged;
    if (isFullRefund) {
      try {
        const revoked = await revokeEntitlementByPaymentIntentId(paymentIntentId);
        if (revoked) {
          console.log(`Entitlement revoked for refund: payment_intent=${paymentIntentId}`);
        }
      } catch (err) {
        console.error("Error revoking entitlement on refund:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
