import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getBundleById } from "@/services/bundle.service";
import { createCheckoutSession } from "@/services/checkout.service";
import { findOrCreateUser } from "@/services/user.service";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json();
    const { bundle_id } = body;

    if (!bundle_id) {
      return NextResponse.json(
        { error: "bad_request", message: "bundle_id is required" },
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

    await findOrCreateUser(auth.id, auth.email);

    const checkoutUrl = await createCheckoutSession(bundle, auth.id, auth.email);
    return NextResponse.json({ data: { checkout_url: checkoutUrl } });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
