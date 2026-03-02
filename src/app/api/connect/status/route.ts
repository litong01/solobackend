import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getUserById } from "@/services/user.service";

/**
 * Return whether the current user has completed Stripe Connect onboarding
 * and can receive payouts from bundle sales.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const user = await getUserById(auth.id);
  const hasAccount = Boolean(user?.stripe_connect_account_id);

  if (!hasAccount) {
    return NextResponse.json({
      data: {
        has_account: false,
        onboarding_complete: false,
        charges_enabled: false,
      },
    });
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(user!.stripe_connect_account_id!);

  return NextResponse.json({
    data: {
      has_account: true,
      onboarding_complete: account.details_submitted,
      charges_enabled: account.charges_enabled ?? false,
    },
  });
}
