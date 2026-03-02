import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { createConnectOnboardingLink } from "@/services/connect.service";

/**
 * Create a Stripe Connect onboarding link for the current user (bundle creator).
 * Redirect the user to the returned URL to complete Connect onboarding.
 * After onboarding, funds from bundle sales are paid to their connected account (with platform fee).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const url = await createConnectOnboardingLink(
      auth.id,
      auth.email ?? ""
    );
    return NextResponse.json({ data: { url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error creating Connect onboarding link:", message, err);

    const stripeType =
      err && typeof err === "object" && "type" in err
        ? (err as { type?: unknown }).type
        : undefined;
    const isConnectNotEnabled =
      stripeType === "StripeInvalidRequestError" &&
      message.includes("signed up for Connect");
    if (isConnectNotEnabled) {
      return NextResponse.json(
        {
          error: "connect_not_enabled",
          message:
            "Stripe Connect is not enabled for this Stripe account. " +
            "In the Stripe Dashboard, go to Settings → Connect and complete the Connect setup. " +
            "Then try again (make sure you're in the same mode as your API key: test vs live).",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "server_error", message: "Failed to create payout setup link" },
      { status: 500 }
    );
  }
}
