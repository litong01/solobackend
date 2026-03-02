"use client";

import { useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { createCheckoutSession } from "@/lib/api-client";

export function PurchaseButton({
  bundleId,
  createdByUserId,
}: {
  bundleId: string;
  /** When the current user is the creator, the button is shown but disabled. */
  createdByUserId?: string | null;
}) {
  const { isAuthenticated, user, login, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    createdByUserId != null && user?.id != null && user.id === createdByUserId;

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => login()}
        className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors"
      >
        Sign in to Purchase
      </button>
    );
  }

  if (isOwner) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-gray-200 px-6 py-3 text-base font-semibold text-gray-500"
        title="You own this bundle"
      >
        Purchase Bundle
      </button>
    );
  }

  async function handlePurchase() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const url = await createCheckoutSession(bundleId, token, user?.email ?? undefined);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Redirecting to checkout…" : "Purchase Bundle"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
