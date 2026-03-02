import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { getCollectionForUser, addToCollection } from "@/services/collection.service";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    const items = await getCollectionForUser(auth.id);
    return NextResponse.json({ data: items });
  } catch (err) {
    console.error("Error listing collection:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to list collection" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  let body: { bundle_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "validation", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const bundleId = body.bundle_id;
  if (typeof bundleId !== "string" || !bundleId.trim()) {
    return NextResponse.json(
      { error: "validation", message: "bundle_id is required" },
      { status: 400 }
    );
  }

  try {
    await addToCollection(auth.id, bundleId.trim());
    return NextResponse.json({ data: { added: true } });
  } catch (err) {
    console.error("Error adding to collection:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to add to collection" },
      { status: 500 }
    );
  }
}
