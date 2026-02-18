import Link from "next/link";
import { Bundle } from "@/types/api";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function BundleCard({ bundle }: { bundle: Bundle }) {
  return (
    <Link
      href={`/bundles/${bundle.id}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-brand-300"
    >
      <div className="flex h-40 items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
        <svg
          className="h-16 w-16 text-brand-400 transition-transform group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"
          />
        </svg>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
          {bundle.title}
        </h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
          {bundle.description}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-brand-600">
            {formatPrice(bundle.price)}
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wide">
            PDF + MusicXML + JSON
          </span>
        </div>
      </div>
    </Link>
  );
}
