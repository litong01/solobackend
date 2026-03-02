"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { fetchBundle, updateBundle } from "@/lib/api-client";
import type { Bundle } from "@/types/api";

export default function EditBundlePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { isAuthenticated, isLoading, login, getToken, user } = useAuth();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchBundle(id)
      .then((data) => {
        if (cancelled) return;
        const b = data as Bundle & { metadata?: unknown };
        setBundle(b);
        setTitle(b.title ?? "");
        setDescription(b.description ?? "");
        setCategory(b.category ?? "");
        setPrice(String(b.price ?? ""));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load bundle");
      });
    return () => { cancelled = true; };
  }, [id]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (chosen) setFile(chosen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!id || !isAuthenticated) return;
    const token = await getToken();
    if (!token) {
      setError("Please sign in again.");
      return;
    }
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("Price must be a non-negative number.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    try {
      await updateBundle(id, token, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        price: priceNum,
        ...(file && file.size > 0 && { file }),
      });
      router.push(`/bundles/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update bundle");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || (id && !bundle && !loadError)) {
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
        <h1 className="text-2xl font-bold text-gray-900">Edit bundle</h1>
        <p className="mt-3 text-gray-500">Sign in to edit a bundle.</p>
        <button
          onClick={() => login()}
          className="mt-6 inline-flex rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (loadError || !bundle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-600">{loadError ?? "Bundle not found."}</p>
        <Link href="/my-bundles" className="mt-4 inline-block text-brand-600 hover:underline">
          Back to My Bundles
        </Link>
      </div>
    );
  }

  const isCreator = bundle.created_by_user_id != null && user?.id === bundle.created_by_user_id;
  if (!isCreator) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-amber-800">You can only edit bundles you created.</p>
        <Link href={`/bundles/${id}`} className="mt-4 inline-block text-brand-600 hover:underline">
          Back to bundle
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href={`/bundles/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
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
            d="M15.75 19.5 8.25 12l7.5-7.5"
          />
        </svg>
        Back to bundle
      </Link>

      <h1 className="text-3xl font-bold text-gray-900">Edit bundle</h1>
      <p className="mt-2 text-gray-500">
        Update the metadata and optionally replace the bundle file with a newer version.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="e.g. Bach Cello Suite No. 1"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="Brief description of the bundle"
          />
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <input
            id="category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="e.g. pop, classic, hymn, piano"
          />
        </div>

        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Price (USD)
          </label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Replace bundle file (optional)
          </label>
          <p className="mt-1 text-sm text-gray-500">
            Upload a new compressed file to replace the current one. Leave empty to keep the existing file.
          </p>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`mt-2 flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 transition-colors ${
              dragActive
                ? "border-brand-500 bg-brand-50"
                : "border-gray-300 bg-gray-50 hover:border-gray-400"
            }`}
          >
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              id="edit-file-upload"
            />
            <label
              htmlFor="edit-file-upload"
              className="cursor-pointer text-center text-sm text-gray-600"
            >
              {file ? (
                <span className="font-medium text-brand-700">{file.name}</span>
              ) : (
                <>
                  <span className="font-medium text-brand-600">Click to upload</span>
                  <span className="text-gray-500"> or drag and drop a new bundle file</span>
                </>
              )}
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="mt-2 text-sm text-gray-500 underline hover:text-gray-700"
              >
                Clear file
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
          <Link
            href={`/bundles/${id}`}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
