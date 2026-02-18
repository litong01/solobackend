import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getUserEntitlements } from "@/services/entitlement.service";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const entitlements = await getUserEntitlements(auth.id);
    return NextResponse.json({ data: entitlements });
  } catch (err) {
    console.error("Error listing entitlements:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list entitlements" },
      { status: 500 }
    );
  }
}
