import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { createRefundForPurchase } from "@/services/refund.service";

/**
 * Request a refund for a bundle the authenticated user purchased.
 * Not exposed in the app UI; the 7-day refund window is enforced here server-side so it cannot be bypassed by calling the API directly.
 * For Connect destination charges, the creator's share is reversed and the platform
 * fee is refunded; the customer is refunded. The webhook charge.refunded revokes access.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const { bundle_id: bundleId, reason } = body as {
      bundle_id?: string;
      reason?: "duplicate" | "fraudulent" | "requested_by_customer";
    };

    if (!bundleId || typeof bundleId !== "string") {
      return NextResponse.json(
        { error: "bad_request", message: "bundle_id is required" },
        { status: 400 }
      );
    }

    const { refund, restocking_fee_cents } = await createRefundForPurchase(auth.id, bundleId, reason);
    return NextResponse.json({
      data: {
        refund_id: refund.id,
        status: refund.status,
        amount: refund.amount,
        amount_refunded_to_customer: refund.amount,
        restocking_fee_cents,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("No purchase found")) {
      return NextResponse.json(
        { error: "not_found", message: "You have not purchased this bundle" },
        { status: 404 }
      );
    }
    if (message.includes("Refund window has closed")) {
      return NextResponse.json(
        { error: "refund_window_closed", message },
        { status: 403 }
      );
    }
    if (message.includes("cannot be refunded") || message.includes("No charge found")) {
      return NextResponse.json(
        { error: "bad_request", message },
        { status: 400 }
      );
    }
    console.error("Error creating refund:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create refund" },
      { status: 500 }
    );
  }
}
