"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { deleteBundle } from "@/lib/api-client";

interface DeleteBundleButtonProps {
  bundleId: string;
  bundleTitle?: string;
  /** If set, only show the button when the current user id matches (e.g. on bundle detail page). */
  createdByUserId?: string | null;
  onDeleted?: () => void;
  onError?: (message: string) => void;
  /** If set, redirect here after successful delete (e.g. "/my-bundles"). */
  redirectOnSuccess?: string;
  className?: string;
  variant?: "list" | "detail";
}

export function DeleteBundleButton({
  bundleId,
  bundleTitle = "This bundle",
  createdByUserId,
  onDeleted,
  onError,
  redirectOnSuccess,
  className = "",
  variant = "list",
}: DeleteBundleButtonProps) {
  const router = useRouter();
  const { getToken, user } = useAuth();
  const [loading, setLoading] = useState(false);

  const isCreator =
    createdByUserId == null || (user?.id != null && user.id === createdByUserId);
  if (!isCreator) return null;

  async function handleClick() {
    if (!confirm(`Delete ${bundleTitle}? This cannot be undone.`)) return;
    const token = await getToken();
    if (!token) {
      onError?.("Please sign in again.");
      return;
    }
    setLoading(true);
    try {
      await deleteBundle(bundleId, token);
      onDeleted?.();
      if (redirectOnSuccess) router.push(redirectOnSuccess);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete bundle";
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors";
  const detailClass = variant === "detail" ? "px-4 py-2.5" : "";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${baseClass} ${detailClass} ${className}`}
      aria-label={`Delete ${bundleTitle}`}
    >
      {loading ? (
        "Deleting…"
      ) : (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
            />
          </svg>
          Delete
        </>
      )}
    </button>
  );
}
