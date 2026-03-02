import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { listBundlesByUser } from "@/services/bundle.service";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const bundles = await listBundlesByUser(auth.id);
    return NextResponse.json({ data: bundles });
  } catch (err) {
    console.error("Error listing my bundles:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list bundles" },
      { status: 500 }
    );
  }
}
