import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import { findOrCreateUser } from "@/services/user.service";
import {
  listBundles,
  createBundleWithId,
  uploadBundleZip,
} from "@/services/bundle.service";

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

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    await findOrCreateUser(auth.id, auth.email);
  } catch (err) {
    console.error("Error ensuring user:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create user" },
      { status: 500 }
    );
  }

  let title: string;
  let description: string;
  let price: number;
  let category: string;
  let file: File | null = null;

  try {
    const formData = await request.formData();
    const t = formData.get("title");
    const d = formData.get("description");
    const p = formData.get("price");
    const c = formData.get("category");
    if (typeof t !== "string" || !t.trim()) {
      return NextResponse.json(
        { error: "validation", message: "title is required" },
        { status: 400 }
      );
    }
    if (typeof d !== "string") {
      return NextResponse.json(
        { error: "validation", message: "description is required" },
        { status: 400 }
      );
    }
    if (p === null || p === undefined) {
      return NextResponse.json(
        { error: "validation", message: "price is required" },
        { status: 400 }
      );
    }
    const priceNum = typeof p === "string" ? parseFloat(p) : Number(p);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json(
        { error: "validation", message: "price must be a non-negative number" },
        { status: 400 }
      );
    }
    title = t.trim();
    description = typeof d === "string" ? d : "";
    price = priceNum;
    category = typeof c === "string" ? c.trim() : "";
    const f = formData.get("file");
    if (f instanceof File && f.size > 0) {
      file = f;
    }
    if (!file) {
      return NextResponse.json(
        { error: "validation", message: "Bundle file (compressed file) is required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "validation", message: "Invalid form data" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file!.arrayBuffer());
    const bundleId = crypto.randomUUID();
    const r2Key = await uploadBundleZip(bundleId, {
      buffer,
      filename: file!.name,
      contentType: file!.type || "application/octet-stream",
    });
    const bundle = await createBundleWithId(bundleId, auth.id, { title, description, price, category }, r2Key);
    return NextResponse.json({ data: bundle });
  } catch (err) {
    console.error("Error creating bundle:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to create bundle" },
      { status: 500 }
    );
  }
}

