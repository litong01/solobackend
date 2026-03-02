"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwaggerUIWrapper } from "@/components/SwaggerUIWrapper";

export default function ApiDocsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/swagger-enabled")
      .then((r) => r.json())
      .then((data) => setEnabled(data.enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">API Docs (Swagger)</h1>
        <p className="mt-4 text-gray-600">
          Swagger UI is disabled in this environment. To enable it, set{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">
            ENABLE_SWAGGER_UI=true
          </code>{" "}
          in <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">.env.local</code> and
          pass it to the container (e.g. <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">--env-file .env.local</code>),
          then restart the container.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-brand-600 hover:text-brand-700"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">SoloBackend API</h1>
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to app
          </Link>
        </div>
      </header>
      <main>
        <SwaggerUIWrapper />
      </main>
    </div>
  );
}
