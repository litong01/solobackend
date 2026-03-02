import { getStripe } from "@/lib/stripe";
import { getUserById, setUserStripeConnectAccountId } from "@/services/user.service";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Create a Stripe Connect Express account for a user (bundle creator) and store the account ID.
 * Idempotent: if the user already has stripe_connect_account_id, returns that account id.
 */
export async function getOrCreateConnectAccount(
  userId: string,
  userEmail: string
): Promise<string> {
  const user = await getUserById(userId);
  if (user?.stripe_connect_account_id) {
    return user.stripe_connect_account_id;
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email: userEmail || undefined,
    metadata: { user_id: userId },
  });

  await setUserStripeConnectAccountId(userId, account.id);
  return account.id;
}

/**
 * Create a Stripe Account Link for Connect onboarding. Redirect the user to the returned URL.
 * If the user does not have a Connect account yet, creates one first.
 */
export async function createConnectOnboardingLink(
  userId: string,
  userEmail: string
): Promise<string> {
  const accountId = await getOrCreateConnectAccount(userId, userEmail);
  const stripe = getStripe();
  const base = siteUrl();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/settings/payouts?refresh=1`,
    return_url: `${base}/settings/payouts?success=1`,
    type: "account_onboarding",
  });
  if (!accountLink.url) {
    throw new Error("Stripe did not return an account link URL");
  }
  return accountLink.url;
}

/**
 * Returns the Connect account ID for a user if they have one and the account can receive charges.
 * Used when creating checkout to decide whether to use a destination charge.
 */
export async function getConnectAccountIdForPayout(userId: string): Promise<string | null> {
  const user = await getUserById(userId);
  const accountId = user?.stripe_connect_account_id ?? null;
  if (!accountId) return null;

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);
  if (!account.charges_enabled) {
    return null;
  }
  return accountId;
}

/**
 * Set the connected account's payout schedule to monthly on the last day of the month.
 * Uses Stripe's Balance Settings API. If your Stripe Node SDK supports it, call:
 *   stripe.balanceSettings.update({ payments: { payouts: { schedule: { interval: 'monthly', monthly_payout_days: [31] } } } }, { stripeAccount })
 * Otherwise configure "Monthly" / "Last day of month" in Stripe Dashboard:
 * Connect → [connected account] → Settings → Payouts → Payout schedule.
 */
export async function setMonthlyPayoutScheduleLastDay(
  _stripeConnectAccountId: string
): Promise<void> {
  // Optional: integrate Balance Settings API when your Stripe SDK exposes it, or use Dashboard.
  void _stripeConnectAccountId;
}
