"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import {
  checkCollectionStatus,
  addToCollection,
  removeFromCollection,
} from "@/lib/api-client";

interface CollectionButtonProps {
  bundleId: string;
  /** When set, button is only shown for non-owners (user id !== createdByUserId). */
  createdByUserId?: string | null;
}

export function CollectionButton({
  bundleId,
  createdByUserId,
}: CollectionButtonProps) {
  const { isAuthenticated, user, getToken } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner =
    createdByUserId != null && user?.id != null && user.id === createdByUserId;
  if (isOwner || !isAuthenticated) return null;

  useEffect(() => {
    let cancelled = false;
    if (isOwner) {
      setChecking(false);
      return;
    }
    getToken().then((token) => {
      if (!token || cancelled) return;
      checkCollectionStatus(bundleId, token)
        .then((data) => {
          if (!cancelled) setSaved(data.saved);
        })
        .catch(() => {
          if (!cancelled) setSaved(false);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    });
    return () => { cancelled = true; };
  }, [bundleId, getToken, isOwner]);

  async function handleToggle() {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (saved) {
        await removeFromCollection(bundleId, token);
        setSaved(false);
      } else {
        await addToCollection(bundleId, token);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="mt-6">
        <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
          Loading…
        </span>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {loading
          ? "…"
          : saved
            ? "Remove from My Collection"
            : "Add to My Collection"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
