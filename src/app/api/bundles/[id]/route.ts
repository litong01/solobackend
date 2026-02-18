import { NextRequest, NextResponse } from "next/server";
import { getBundleById, getBundleMetadata } from "@/services/bundle.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bundle = await getBundleById(params.id);
    if (!bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404 }
      );
    }

    let metadata = null;
    if (bundle.metadata_url) {
      metadata = await getBundleMetadata(bundle.metadata_url);
    }

    return NextResponse.json({ data: { ...bundle, metadata } });
  } catch (err) {
    console.error("Error getting bundle:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to get bundle" },
      { status: 500 }
    );
  }
}
