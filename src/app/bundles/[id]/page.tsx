import { getBundleById, getBundleMetadata } from "@/services/bundle.service";
import { PurchaseButton } from "@/components/PurchaseButton";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function fileTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pdf: "PDF Score",
    musicxml: "MusicXML",
    json: "JSON Data",
  };
  return labels[type] || type.toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function BundleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const bundle = await getBundleById(params.id);
  if (!bundle) notFound();

  let metadata = null;
  if (bundle.metadata_url) {
    metadata = await getBundleMetadata(bundle.metadata_url);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href="/"
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
        Back to bundles
      </Link>

      <div className="grid gap-8 md:grid-cols-5">
        {/* Preview area */}
        <div className="md:col-span-3">
          <div className="flex h-64 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100">
            <svg
              className="h-24 w-24 text-brand-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
              />
            </svg>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-bold text-gray-900">{bundle.title}</h1>
            <p className="mt-3 leading-relaxed text-gray-600">
              {bundle.description}
            </p>

            {metadata && (
              <div className="mt-6 space-y-3">
                {metadata.composer && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">Composer:</span>{" "}
                    {metadata.composer}
                  </p>
                )}
                {metadata.genre && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">Genre:</span>{" "}
                    {metadata.genre}
                  </p>
                )}
                {metadata.difficulty && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">
                      Difficulty:
                    </span>{" "}
                    {metadata.difficulty}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Purchase sidebar */}
        <div className="md:col-span-2">
          <div className="sticky top-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 text-center">
              <span className="text-3xl font-bold text-brand-600">
                {formatPrice(bundle.price)}
              </span>
            </div>

            <PurchaseButton bundleId={bundle.id} />

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Included Files
              </h3>
              {metadata?.files ? (
                <ul className="mt-3 space-y-2">
                  {metadata.files.map((file) => (
                    <li
                      key={file.key}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-gray-700">
                        {fileTypeLabel(file.type)}
                      </span>
                      <span className="text-gray-400">
                        {formatBytes(file.size_bytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 space-y-2">
                  {["PDF Score", "MusicXML", "JSON Data"].map((lbl) => (
                    <li
                      key={lbl}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600"
                    >
                      <svg
                        className="h-4 w-4 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m4.5 12.75 6 6 9-13.5"
                        />
                      </svg>
                      {lbl}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
