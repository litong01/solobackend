import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getPool } from "@/lib/db";
import { getR2Client } from "@/lib/r2";
import { Bundle, BundleMetadata } from "@/types/api";

function getR2Bucket(): string {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET is not set");
  return bucket;
}

/** Current month prefix for R2: YYYYMM (e.g. 202603). */
export function getR2MonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export function isBundleCreator(bundle: Bundle, userId: string): boolean {
  return bundle.created_by_user_id != null && bundle.created_by_user_id === userId;
}

export async function listBundles(): Promise<Bundle[]> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles ORDER BY created_at DESC"
  );
  return result.rows;
}

export async function listBundlesByUser(userId: string): Promise<Bundle[]> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    "SELECT * FROM bundles WHERE created_by_user_id = $1 ORDER BY created_at DESC",
    [userId]
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

export interface CreateBundleInput {
  title: string;
  description: string;
  price: number;
  category: string;
}

export interface UpdateBundleInput {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
}

export async function updateBundle(
  bundleId: string,
  input: UpdateBundleInput
): Promise<Bundle> {
  const pool = getPool();
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (input.title !== undefined) {
    updates.push(`title = $${i++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(input.description);
  }
  if (input.price !== undefined) {
    updates.push(`price = $${i++}`);
    values.push(input.price);
  }
  if (input.category !== undefined) {
    updates.push(`category = $${i++}`);
    values.push(input.category);
  }
  if (updates.length === 0) {
    const b = await getBundleById(bundleId);
    if (!b) throw new Error("Bundle not found");
    return b;
  }
  values.push(bundleId);
  const result = await pool.query<Bundle>(
    `UPDATE bundles SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
    values
  );
  if (!result.rows[0]) throw new Error("Bundle not found");
  return result.rows[0];
}

export async function createBundle(
  userId: string,
  input: CreateBundleInput
): Promise<Bundle> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    `INSERT INTO bundles (title, description, price, category, created_by_user_id, metadata_url, r2_key)
     VALUES ($1, $2, $3, $4, $5, NULL, NULL) RETURNING *`,
    [input.title, input.description, input.price, input.category, userId]
  );
  return result.rows[0];
}

/** Insert a bundle with a specific id and r2_key (used after successful R2 upload). */
export async function createBundleWithId(
  bundleId: string,
  userId: string,
  input: CreateBundleInput,
  r2Key: string
): Promise<Bundle> {
  const pool = getPool();
  const result = await pool.query<Bundle>(
    `INSERT INTO bundles (id, title, description, price, category, created_by_user_id, metadata_url, r2_key)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, $7) RETURNING *`,
    [bundleId, input.title, input.description, input.price, input.category, userId, r2Key]
  );
  return result.rows[0];
}

export async function updateBundleR2Key(
  bundleId: string,
  r2Key: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    "UPDATE bundles SET r2_key = $1 WHERE id = $2",
    [r2Key, bundleId]
  );
}

/**
 * Upload the bundle as a single compressed file to R2 under bundles/YYYYMM/{bundleId}.zip.
 * Returns the R2 key (e.g. bundles/202603/uuid.zip).
 * Logs the exact bucket and key used so you can verify in Cloudflare R2 / debug AccessDenied.
 */
export async function uploadBundleZip(
  bundleId: string,
  file: { buffer: Buffer; filename: string; contentType: string }
): Promise<string> {
  const r2 = getR2Client();
  const bucket = getR2Bucket();
  const monthPrefix = getR2MonthPrefix();
  const ext = file.filename.includes(".") ? file.filename.replace(/^.*\./, ".") : ".zip";
  const key = `bundles/${monthPrefix}/${bundleId}${ext}`;

  console.log("[R2] PutObject: bucket=%s key=%s (endpoint uses CLOUDFLARE_R2_ACCOUNT_ID)", bucket, key);

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.contentType,
    })
  );

  return key;
}

/**
 * Overwrite the object at an existing R2 key with a new file (e.g. replace bundle file).
 */
export async function uploadBundleFileAtKey(
  r2Key: string,
  file: { buffer: Buffer; filename: string; contentType: string }
): Promise<void> {
  const r2 = getR2Client();
  const bucket = getR2Bucket();
  console.log("[R2] PutObject (replace): bucket=%s key=%s", bucket, r2Key);
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: file.buffer,
      ContentType: file.contentType,
    })
  );
}

/**
 * Replace or set the bundle file in R2. If bundle already has r2_key, overwrite at that key.
 * Otherwise upload to bundles/YYYYMM/{bundleId}.ext and set r2_key.
 */
export async function replaceBundleFile(
  bundle: Bundle,
  file: { buffer: Buffer; filename: string; contentType: string }
): Promise<void> {
  if (bundle.r2_key) {
    await uploadBundleFileAtKey(bundle.r2_key, file);
    return;
  }
  const key = await uploadBundleZip(bundle.id, file);
  await updateBundleR2Key(bundle.id, key);
}

export async function getBundleMetadata(metadataUrl: string): Promise<BundleMetadata | null> {
  try {
    const r2 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: metadataUrl,
    });
    const response = await r2.send(command);
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "Code" in err ? (err as { Code?: string }).Code : undefined;
    if (code === "NoSuchKey") {
      console.warn("Bundle metadata not found in R2:", metadataUrl);
    } else {
      console.error("Failed to fetch bundle metadata from R2:", err);
    }
    return null;
  }
}

export async function generateDownloadUrl(
  fileKey: string,
  expiresInSeconds = 300
): Promise<string> {
  const r2 = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: fileKey,
  });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

/** Delete an object from R2 by key. No-op if key is empty. */
export async function deleteR2Object(key: string): Promise<void> {
  if (!key) return;
  const r2 = getR2Client();
  const bucket = getR2Bucket();
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Delete a bundle (DB row and R2 object if r2_key set). Caller must ensure
 * the user is the creator and the bundle has no purchases.
 */
export async function deleteBundle(bundleId: string): Promise<void> {
  const bundle = await getBundleById(bundleId);
  if (!bundle) return;
  if (bundle.r2_key) {
    await deleteR2Object(bundle.r2_key);
  }
  const pool = getPool();
  await pool.query("DELETE FROM bundles WHERE id = $1", [bundleId]);
}
