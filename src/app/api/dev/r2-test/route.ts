import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";

/**
 * Dev-only: test R2 write access. Call GET /api/dev/r2-test to try a minimal PutObject.
 * Returns bucket, key, endpoint (no secrets), and success or error details.
 */
export async function GET() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const hasAccessKey = Boolean(process.env.CLOUDFLARE_R2_ACCESS_KEY);
  const hasSecretKey = Boolean(process.env.CLOUDFLARE_R2_SECRET_KEY);

  if (!bucket || !accountId) {
    return NextResponse.json({
      ok: false,
      message: "Missing env",
      env: { bucket: !!bucket, accountId: !!accountId, accessKey: hasAccessKey, secretKey: hasSecretKey },
    }, { status: 500 });
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const testKey = `r2-write-test-${Date.now()}.txt`;

  try {
    const r2 = getR2Client();
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: testKey,
        Body: Buffer.from("R2 write test from SoloBackend"),
        ContentType: "text/plain",
      })
    );
    return NextResponse.json({
      ok: true,
      message: "R2 PutObject succeeded",
      bucket,
      key: testKey,
      endpoint,
      hint: "If bundle upload still fails, compare this key with the bundle key (e.g. bundles/202603/uuid.zip).",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === "object" && "Code" in err ? (err as { Code?: string }).Code : undefined;
    return NextResponse.json({
      ok: false,
      message: "R2 PutObject failed",
      error: message,
      code,
      bucket,
      key: testKey,
      endpoint,
      hint: "Check R2 API token has Object Read & Write (or Admin), and applies to this bucket.",
    }, { status: 502 });
  }
}
