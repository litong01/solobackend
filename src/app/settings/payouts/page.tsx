"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { fetchConnectStatus, createConnectOnboardingUrl } from "@/lib/api-client";
import Link from "next/link";

function PayoutsContent() {
  const { isAuthenticated, isLoading, login, getToken } = useAuth();
  const [status, setStatus] = useState<{
    has_account: boolean;
    onboarding_complete: boolean;
    charges_enabled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingOnboard, setStartingOnboard] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error("No token");
        const data = await fetchConnectStatus(token);
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payout status");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, isLoading, getToken]);

  async function handleSetUpPayouts() {
    const token = await getToken();
    if (!token) return;
    setStartingOnboard(true);
    setError(null);
    try {
      const url = await createConnectOnboardingUrl(token);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payout setup");
      setStartingOnboard(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-200" />
          <div className="h-32 rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Receive payouts</h1>
        <p className="mt-3 text-gray-500">
          Sign in to set up Stripe so you can receive money when users buy your bundles.
        </p>
        <button
          onClick={() => login()}
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/my-bundles"
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        ← My Bundles
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-gray-900">Receive payouts</h1>
      <p className="mt-2 text-gray-500">
        When buyers purchase your bundles, you can receive the money (minus a platform fee) via Stripe Connect. Set up your payout account below; payouts are sent monthly (e.g. last day of the month, depending on platform settings).
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 animate-pulse h-24 rounded-xl bg-gray-200" />
      ) : status ? (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {status.charges_enabled ? (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              <div>
                <p className="font-medium text-gray-900">Payout account connected</p>
                <p className="text-sm text-gray-500">
                  You’ll receive your share of bundle sales according to the payout schedule (e.g. monthly).
                </p>
              </div>
            </div>
          ) : status.has_account && !status.onboarding_complete ? (
            <div>
              <p className="font-medium text-gray-900">Finish setting up your account</p>
              <p className="mt-1 text-sm text-gray-500">
                Complete the Stripe onboarding to start receiving payouts.
              </p>
              <button
                onClick={handleSetUpPayouts}
                disabled={startingOnboard}
                className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {startingOnboard ? "Redirecting…" : "Continue setup"}
              </button>
            </div>
          ) : status.has_account && status.onboarding_complete && !status.charges_enabled ? (
            <div>
              <p className="font-medium text-amber-800">Account pending</p>
              <p className="mt-1 text-sm text-gray-500">
                Stripe may still be verifying your account. You can try updating your details.
              </p>
              <button
                onClick={handleSetUpPayouts}
                disabled={startingOnboard}
                className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {startingOnboard ? "Redirecting…" : "Update account"}
              </button>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-900">Set up payouts</p>
              <p className="mt-1 text-sm text-gray-500">
                Connect a Stripe account to receive money when users buy your bundles. Payouts are sent on a schedule (e.g. monthly).
              </p>
              <button
                onClick={handleSetUpPayouts}
                disabled={startingOnboard}
                className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {startingOnboard ? "Redirecting…" : "Set up payouts with Stripe"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-24 rounded-xl bg-gray-200" />
          </div>
        </div>
      }
    >
      <PayoutsContent />
    </Suspense>
  );
}
