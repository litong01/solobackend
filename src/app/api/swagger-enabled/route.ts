import { NextResponse } from "next/server";

/**
 * Returns whether Swagger UI is enabled.
 * Enabled in development or when using a Stripe test key (sk_test_...) so one env var drives dev mode.
 */
export async function GET() {
  const nodeEnv = process.env.NODE_ENV;
  const stripeKey = process.env["STRIPE_SECRET_KEY"] ?? "";
  const isTestKey = stripeKey.startsWith("sk_test_");
  const enabled = nodeEnv === "development" || isTestKey;
  return NextResponse.json({ enabled });
}
