import { BundleCard } from "@/components/BundleCard";
import { fetchBundles } from "@/lib/api";
import { Bundle } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let bundles: Bundle[] = [];
  try {
    bundles = await fetchBundles();
  } catch {
    bundles = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Digital Music Bundles
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Professional scores in PDF, MusicXML, and JSON — ready for practice,
          performance, and analysis.
        </p>
      </div>

      {bundles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
          <p className="text-gray-400">No bundles available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      )}
    </div>
  );
}
