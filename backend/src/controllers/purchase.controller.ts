import { Request, Response } from "express";
import * as bundleService from "../services/bundle.service";
import * as checkoutService from "../services/checkout.service";
import * as userService from "../services/user.service";

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.sub;
    const email = req.user!.email || "";

    const { bundle_id } = req.body;
    if (!bundle_id) {
      res.status(400).json({ error: "bad_request", message: "bundle_id is required" });
      return;
    }

    const bundle = await bundleService.getBundleById(bundle_id);
    if (!bundle) {
      res.status(404).json({ error: "not_found", message: "Bundle not found" });
      return;
    }

    await userService.findOrCreateUser(userId, email);

    const checkoutUrl = await checkoutService.createCheckoutSession(bundle, userId, email);
    res.json({ data: { checkout_url: checkoutUrl } });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    res.status(500).json({ error: "server_error", message: "Failed to create checkout session" });
  }
}
