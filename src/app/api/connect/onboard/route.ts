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
    return NextResponse.json(
      { error: "server_error", message: "Failed to create payout setup link" },
      { status: 500 }
    );
  }
}
