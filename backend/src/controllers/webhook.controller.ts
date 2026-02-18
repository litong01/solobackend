import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import * as entitlementService from "../services/entitlement.service";
import * as userService from "../services/user.service";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "bad_request", message: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.stripe.webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).json({ error: "bad_request", message: "Invalid webhook signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.user_id;
    const bundleId = session.metadata?.bundle_id;

    if (!userId || !bundleId) {
      console.error("Webhook missing metadata:", { userId, bundleId });
      res.status(400).json({ error: "bad_request", message: "Missing metadata in checkout session" });
      return;
    }

    try {
      await userService.findOrCreateUser(userId, session.customer_email || "");
      await entitlementService.createEntitlement(userId, bundleId);
      console.log(`Entitlement created: user=${userId} bundle=${bundleId}`);
    } catch (err) {
      console.error("Error processing webhook:", err);
      res.status(500).json({ error: "server_error", message: "Failed to process purchase" });
      return;
    }
  }

  res.json({ received: true });
}
