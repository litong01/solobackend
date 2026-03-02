"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import { fetchMyBundles } from "@/lib/api-client";
import { Bundle } from "@/types/api";
import Link from "next/link";
import { DeleteBundleButton } from "@/components/DeleteBundleButton";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function MyBundlesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-200" />
            <div className="h-32 rounded-xl bg-gray-200" />
          </div>
        </div>
      }
    >
      <MyBundlesContent />
    </Suspense>
  );
}

function MyBundlesContent() {
  const { isAuthenticated, isLoading, login, getToken } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error("No token");
        const data = await fetchMyBundles(token);
        setBundles(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load your bundles"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, isLoading, getToken]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
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
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">My Bundles</h1>
        <p className="mt-3 text-gray-500">
          Sign in to view and create bundles.
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
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Bundles</h1>
          <p className="mt-2 text-gray-500">Bundles you’ve created.</p>
        </div>
        <Link
          href="/my-bundles/create"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700 transition-colors"
        >
          Create bundle
        </Link>
        <Link
          href="/settings/payouts"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Payouts
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 animate-pulse space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          {error}
        </div>
      ) : bundles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-500">You haven’t created any bundles yet.</p>
          <Link
            href="/my-bundles/create"
            className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2 text-white hover:bg-brand-700 transition-colors"
          >
            Create bundle
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {deleteError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              {deleteError}
            </div>
          )}
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-gray-300"
            >
              <Link
                href={`/bundles/${bundle.id}`}
                className="min-w-0 flex-1"
              >
                <h2 className="font-semibold text-gray-900 hover:text-brand-700 transition-colors">
                  {bundle.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500 line-clamp-1">
                  {bundle.description}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Created{" "}
                  {new Date(bundle.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {bundle.category && ` · ${bundle.category}`}
                  {" · "}
                  {formatPrice(bundle.price)}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/my-bundles/${bundle.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Edit
                </Link>
                <DeleteBundleButton
                  bundleId={bundle.id}
                  bundleTitle={bundle.title}
                  onDeleted={() => {
                    setDeleteError(null);
                    setBundles((prev) => prev.filter((b) => b.id !== bundle.id));
                  }}
                  onError={setDeleteError}
                />
                <Link
                  href={`/bundles/${bundle.id}`}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`View ${bundle.title}`}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m9 5 7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
