import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: required("DATABASE_URL"),

  kinde: {
    issuerUrl: required("KINDE_ISSUER_URL"),
    clientId: required("KINDE_CLIENT_ID"),
    audience: process.env.KINDE_AUDIENCE || "",
  },

  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  },

  r2: {
    accountId: required("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKey: required("CLOUDFLARE_R2_ACCESS_KEY"),
    secretKey: required("CLOUDFLARE_R2_SECRET_KEY"),
    bucket: required("CLOUDFLARE_R2_BUCKET"),
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
} as const;
