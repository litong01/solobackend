import { pool } from "../config/database";
import { Bundle, BundleMetadata } from "../types/api";
import { r2Client } from "../config/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

export async function listBundles(): Promise<Bundle[]> {
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function getBundleById(id: string): Promise<Bundle | null> {
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function getBundleMetadata(metadataUrl: string): Promise<BundleMetadata | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: env.r2.bucket,
      Key: metadataUrl,
    });
    const response = await r2Client.send(command);
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
  const command = new GetObjectCommand({
    Bucket: env.r2.bucket,
    Key: fileKey,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
