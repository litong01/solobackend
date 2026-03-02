import { S3Client } from "@aws-sdk/client-s3";

let r2Instance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!r2Instance) {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    if (!accountId) throw new Error("CLOUDFLARE_R2_ACCOUNT_ID is not set");
    r2Instance = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
      },
    });
  }
  return r2Instance;
}
