"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/use-auth";
import { fetchCollection, removeFromCollection } from "@/lib/api-client";
import { DownloadButton } from "@/components/DownloadButton";
import { PurchaseButton } from "@/components/PurchaseButton";
import { DeleteBundleButton } from "@/components/DeleteBundleButton";
import type { CollectionItem } from "@/types/api";
import Link from "next/link";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function LibraryPage() {
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
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login, getToken } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(false);

  useEffect(() => {
    const purchase = searchParams.get("purchase");
    if (purchase === "success") setShowPurchaseSuccess(true);
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error("No token");
        const data = await fetchCollection(token);
        setItems(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load your collection"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, isLoading, getToken]);

  async function handleRemoveFromCollection(bundleId: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await removeFromCollection(bundleId, token);
      setItems((prev) => prev.filter((it) => it.bundle.id !== bundleId));
    } catch {
      // ignore
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900">My Collection</h1>
        <p className="mt-3 text-gray-500">
          Sign in to view your collection (purchased, owned, and saved bundles).
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
      <h1 className="text-3xl font-bold text-gray-900">My Collection</h1>
      <p className="mt-2 text-gray-500">
        Purchased, owned, and saved bundles in one place.
      </p>

      {showPurchaseSuccess && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          <p className="font-semibold">Thanks for your purchase!</p>
          <p className="mt-1 text-sm text-green-700">
            Your bundle is in your collection below. You can download it anytime.
          </p>
        </div>
      )}

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
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400">Your collection is empty.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg bg-brand-600 px-5 py-2 text-white hover:bg-brand-700 transition-colors"
          >
            Explore bundles
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <div
              key={item.bundle.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/bundles/${item.bundle.id}`}
                  className="font-semibold text-gray-900 hover:text-brand-700 transition-colors"
                >
                  {item.bundle.title}
                </Link>
                <p className="mt-1 text-sm text-gray-400">
                  {item.type === "purchased" && item.purchased_at && (
                    <>
                      Purchased{" "}
                      {new Date(item.purchased_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {" · "}
                    </>
                  )}
                  {item.type === "saved" && item.added_at && (
                    <>
                      Saved{" "}
                      {new Date(item.added_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {" · "}
                    </>
                  )}
                  {item.type === "owned" && "You created this · "}
                  {formatPrice(item.bundle.price)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.type === "purchased" && (
                  <DownloadButton bundleId={item.bundle.id} label="Download" />
                )}
                {item.type === "owned" && (
                  <>
                    <Link
                      href={`/my-bundles/${item.bundle.id}/edit`}
                      className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/bundles/${item.bundle.id}`}
                      className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View
                    </Link>
                    {item.bundle.r2_key && (
                      <DownloadButton bundleId={item.bundle.id} label="Download" />
                    )}
                    <DeleteBundleButton
                      bundleId={item.bundle.id}
                      bundleTitle={item.bundle.title}
                      variant="list"
                      onDeleted={() =>
                        setItems((prev) =>
                          prev.filter((it) => it.bundle.id !== item.bundle.id)
                        )
                      }
                    />
                  </>
                )}
                {item.type === "saved" && (
                  <>
                    <PurchaseButton
                      bundleId={item.bundle.id}
                      createdByUserId={item.bundle.created_by_user_id}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCollection(item.bundle.id)}
                      className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Remove from collection
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
