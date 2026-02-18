"use client";

import { useEffect, useState } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { fetchEntitlements } from "@/lib/api-client";
import { DownloadButton } from "@/components/DownloadButton";
import { EntitlementWithBundle } from "@/types/api";
import Link from "next/link";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function LibraryPage() {
  const { isAuthenticated, isLoading, login, getToken } = useKindeAuth();
  const [entitlements, setEntitlements] = useState<EntitlementWithBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error("No token");
        const data = await fetchEntitlements(token);
        setEntitlements(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load library"
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
        <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
        <p className="mt-3 text-gray-500">
          Sign in to view your purchased bundles.
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
      <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
      <p className="mt-2 text-gray-500">Your purchased music bundles.</p>

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
      ) : entitlements.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400">
            You haven&apos;t purchased any bundles yet.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2 text-white hover:bg-brand-700 transition-colors"
          >
            Browse bundles
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {entitlements.map((ent) => (
            <div
              key={ent.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div>
                <Link
                  href={`/bundles/${ent.bundle.id}`}
                  className="font-semibold text-gray-900 hover:text-brand-700 transition-colors"
                >
                  {ent.bundle.title}
                </Link>
                <p className="mt-1 text-sm text-gray-400">
                  Purchased{" "}
                  {new Date(ent.purchased_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" · "}
                  {formatPrice(ent.bundle.price)}
                </p>
              </div>
              <DownloadButton bundleId={ent.bundle.id} label="Download" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
