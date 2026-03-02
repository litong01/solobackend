import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  getBundleById,
  getBundleMetadata,
  generateDownloadUrl,
  isBundleCreator,
} from "@/services/bundle.service";
import { userOwnsBundle } from "@/services/entitlement.service";
import { isInSavedCollection } from "@/services/collection.service";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const bundleId = params.id;
    const bundle = await getBundleById(bundleId);
    if (!bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404 }
      );
    }

    const ownsByPurchase = await userOwnsBundle(auth.id, bundleId);
    const isCreator = isBundleCreator(bundle, auth.id);
    const inCollection = await isInSavedCollection(auth.id, bundleId);
    const canDownload = ownsByPurchase || isCreator || inCollection;
    if (!canDownload) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not have access to this bundle" },
        { status: 403 }
      );
    }

    // Allow mobile to request longer-lived URLs (e.g. for background download). Default 5 min; max 1 hour.
    const requestedExpires = request.nextUrl.searchParams.get("expires_in");
    const expiresIn = requestedExpires
      ? Math.min(3600, Math.max(60, parseInt(requestedExpires, 10) || 300))
      : 300;

    // User bundle: single file at r2_key (e.g. bundles/202603/uuid.zip)
    if (bundle.r2_key) {
      const downloadUrl = await generateDownloadUrl(bundle.r2_key, expiresIn);
      const filename = bundle.r2_key.split("/").pop() ?? "bundle.zip";
      return NextResponse.json({
        data: {
          download_url: downloadUrl,
          filename,
          expires_in: expiresIn,
        },
      });
    }

    // Legacy seed bundle: metadata.json with multiple files
    if (!bundle.metadata_url) {
      return NextResponse.json(
        {
          error: "unavailable",
          message:
            "Download is not available for this bundle yet. Upload a bundle file first.",
        },
        { status: 503 }
      );
    }

    const metadata = await getBundleMetadata(bundle.metadata_url);
    if (!metadata?.files?.length) {
      return NextResponse.json(
        {
          error: "unavailable",
          message:
            "Download is not available for this bundle yet. The bundle files have not been uploaded to storage.",
        },
        { status: 503 }
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
