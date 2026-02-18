import { NextRequest, NextResponse } from "next/server";
import { findOrCreateUser } from "@/services/user.service";
import { createEntitlement } from "@/services/entitlement.service";
import { getBundleById } from "@/services/bundle.service";

/**
 * DEV ONLY — Simulates a purchase by creating an entitlement directly.
 * Skips Stripe entirely. Disabled when NODE_ENV is "production".
 *
 * POST /api/dev/simulate-purchase
 * Body: { "user_id": "...", "user_email": "...", "bundle_id": "..." }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "not_found", message: "Not found" },
      { status: 404 }
    );
  }

  try {
    const { user_id, user_email, bundle_id } = await request.json();

    if (!user_id || !bundle_id) {
      return NextResponse.json(
        { error: "bad_request", message: "user_id and bundle_id are required" },
        { status: 400 }
      );
    }

    const bundle = await getBundleById(bundle_id);
    if (!bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404 }
      );
    }

    await findOrCreateUser(user_id, user_email || "dev@test.com");
    const entitlement = await createEntitlement(user_id, bundle_id);

    return NextResponse.json({
      data: {
        message: "Purchase simulated",
        entitlement,
        bundle: { id: bundle.id, title: bundle.title },
      },
    });
  } catch (err) {
    console.error("Error simulating purchase:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to simulate purchase" },
      { status: 500 }
    );
  }
}
