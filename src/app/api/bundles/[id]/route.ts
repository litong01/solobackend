import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth";
import {
  getBundleById,
  getBundleMetadata,
  isBundleCreator,
  deleteBundle,
  updateBundle,
  replaceBundleFile,
} from "@/services/bundle.service";
import { bundleHasPurchases } from "@/services/entitlement.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bundle = await getBundleById(params.id);
    if (!bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404 }
      );
    }

    let metadata = null;
    if (bundle.metadata_url) {
      metadata = await getBundleMetadata(bundle.metadata_url);
    }

    return NextResponse.json({ data: { ...bundle, metadata } });
  } catch (err) {
    console.error("Error getting bundle:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to get bundle" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const bundleId = params.id;
  const bundle = await getBundleById(bundleId);
  if (!bundle) {
    return NextResponse.json(
      { error: "not_found", message: "Bundle not found" },
      { status: 404 }
    );
  }

  if (!isBundleCreator(bundle, auth.id)) {
    return NextResponse.json(
      { error: "forbidden", message: "Only the bundle creator can delete it" },
      { status: 403 }
    );
  }

  const hasPurchases = await bundleHasPurchases(bundleId);
  if (hasPurchases) {
    return NextResponse.json(
      { error: "cannot_delete", message: "Cannot delete a bundle that has been purchased. Remove or refund purchases first." },
      { status: 409 }
    );
  }

  try {
    await deleteBundle(bundleId);
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Error deleting bundle:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to delete bundle" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const bundleId = params.id;
  const bundle = await getBundleById(bundleId);
  if (!bundle) {
    return NextResponse.json(
      { error: "not_found", message: "Bundle not found" },
      { status: 404 }
    );
  }

  if (!isBundleCreator(bundle, auth.id)) {
    return NextResponse.json(
      { error: "forbidden", message: "Only the bundle creator can update it" },
      { status: 403 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let title: string | undefined;
  let description: string | undefined;
  let price: number | undefined;
  let category: string | undefined;
  let file: File | null = null;

  if (isMultipart) {
    try {
      const formData = await request.formData();
      const t = formData.get("title");
      const d = formData.get("description");
      const p = formData.get("price");
      const c = formData.get("category");
      const f = formData.get("file");
      title = typeof t === "string" ? t.trim() : undefined;
      description = typeof d === "string" ? d : undefined;
      price = p != null ? (typeof p === "string" ? parseFloat(p) : Number(p)) : undefined;
      category = typeof c === "string" ? c.trim() : undefined;
      if (f instanceof File && f.size > 0) file = f;
    } catch {
      return NextResponse.json(
        { error: "validation", message: "Invalid form data" },
        { status: 400 }
      );
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "validation", message: "Invalid JSON body" },
        { status: 400 }
      );
    }
    title = typeof body.title === "string" ? body.title.trim() : undefined;
    description = typeof body.description === "string" ? body.description : undefined;
    price = typeof body.price === "number" ? body.price : typeof body.price === "string" ? parseFloat(body.price) : undefined;
    category = typeof body.category === "string" ? body.category.trim() : undefined;
  }

  if (title !== undefined && title.length === 0) {
    return NextResponse.json(
      { error: "validation", message: "title cannot be empty" },
      { status: 400 }
    );
  }
  if (price !== undefined && (Number.isNaN(price) || price < 0)) {
    return NextResponse.json(
      { error: "validation", message: "price must be a non-negative number" },
      { status: 400 }
    );
  }

  try {
    let updated = await updateBundle(bundleId, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(category !== undefined && { category }),
    });
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await replaceBundleFile(updated, {
        buffer,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      });
      updated = (await getBundleById(bundleId)) ?? updated;
    }
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Error updating bundle:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to update bundle" },
      { status: 500 }
    );
  }
}
