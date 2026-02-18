import { NextResponse } from "next/server";
import { listBundles } from "@/services/bundle.service";

export async function GET() {
  try {
    const bundles = await listBundles();
    return NextResponse.json({ data: bundles });
  } catch (err) {
    console.error("Error listing bundles:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list bundles" },
      { status: 500 }
    );
  }
}
