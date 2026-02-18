import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getBundleById, getBundleMetadata, generateDownloadUrl } from "@/services/bundle.service";
import { userOwnsBundle } from "@/services/entitlement.service";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const bundleId = params.id;

    const owns = await userOwnsBundle(auth.id, bundleId);
    if (!owns) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not own this bundle" },
        { status: 403 }
      );
    }

    const bundle = await getBundleById(bundleId);
    if (!bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404 }
      );
    }

    const metadata = await getBundleMetadata(bundle.metadata_url);
    if (!metadata?.files?.length) {
      return NextResponse.json(
        { error: "not_found", message: "No files found for this bundle" },
        { status: 404 }
      );
    }

    const fileParam = request.nextUrl.searchParams.get("file");
    const file = fileParam
      ? metadata.files.find((f) => f.key === fileParam)
      : metadata.files[0];

    if (!file) {
      return NextResponse.json(
        { error: "not_found", message: "Requested file not found in bundle" },
        { status: 404 }
      );
    }

    const expiresIn = 300;
    const downloadUrl = await generateDownloadUrl(file.key, expiresIn);

    return NextResponse.json({
      data: {
        download_url: downloadUrl,
        filename: file.filename,
        expires_in: expiresIn,
      },
    });
  } catch (err) {
    console.error("Error generating download URL:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
