import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { isInSavedCollection } from "@/services/collection.service";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const bundleId = request.nextUrl.searchParams.get("bundle_id");
  if (!bundleId) {
    return NextResponse.json(
      { error: "validation", message: "bundle_id query is required" },
      { status: 400 }
    );
  }

  try {
    const saved = await isInSavedCollection(auth.id, bundleId);
    return NextResponse.json({ data: { saved } });
  } catch (err) {
    console.error("Error checking collection status:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to check status" },
      { status: 500 }
    );
  }
}
