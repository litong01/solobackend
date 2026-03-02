import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { removeFromCollection } from "@/services/collection.service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { bundleId: string } }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const bundleId = params.bundleId;
  if (!bundleId) {
    return NextResponse.json(
      { error: "validation", message: "bundle id required" },
      { status: 400 }
    );
  }

  try {
    await removeFromCollection(auth.id, bundleId);
    return NextResponse.json({ data: { removed: true } });
  } catch (err) {
    console.error("Error removing from collection:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to remove from collection" },
      { status: 500 }
    );
  }
}
