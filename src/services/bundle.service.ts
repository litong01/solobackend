import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPool } from "@/lib/db";
import { getR2Client } from "@/lib/r2";
import { Bundle, BundleMetadata } from "@/types/api";

export async function listBundles(): Promise<Bundle[]> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function getBundleById(id: string): Promise<Bundle | null> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function getBundleMetadata(metadataUrl: string): Promise<BundleMetadata | null> {
  try {
    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      Key: metadataUrl,
    });
    const response = await r2.send(command);
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch (err) {
    console.error("Failed to fetch bundle metadata from R2:", err);
    return null;
  }
}

export async function generateDownloadUrl(
  fileKey: string,
  expiresInSeconds = 300
): Promise<string> {
  const r2 = getR2Client();
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
    Key: fileKey,
  });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}
