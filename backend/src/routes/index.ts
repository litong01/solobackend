import { Router, raw, json } from "express";
import { authenticate } from "../middleware/auth";
import * as bundleController from "../controllers/bundle.controller";
import * as entitlementController from "../controllers/entitlement.controller";
import * as purchaseController from "../controllers/purchase.controller";
import * as webhookController from "../controllers/webhook.controller";

const router = Router();

// Stripe webhook — must use raw body parser, placed before json() middleware
router.post(
  "/api/stripe/webhook",
  raw({ type: "application/json" }),
  webhookController.handleStripeWebhook
);

// JSON-parsed routes
router.use(json());

// Public
router.get("/api/bundles", bundleController.listBundles);
router.get("/api/bundles/:id", bundleController.getBundle);

// Protected
router.get("/api/entitlements", authenticate, entitlementController.listEntitlements);
router.post("/api/purchase/create-checkout-session", authenticate, purchaseController.createCheckoutSession);
router.get("/api/bundles/:id/download", authenticate, bundleController.downloadBundle);

// Health check
router.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
