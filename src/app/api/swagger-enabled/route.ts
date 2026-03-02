import { NextResponse } from "next/server";

/**
 * Returns whether Swagger UI is enabled (for runtime env check in Docker).
 * Uses bracket notation so the bundler does not inline the value at build time.
 */
export async function GET() {
  const nodeEnv = process.env.NODE_ENV;
  const swaggerFlag = process.env["ENABLE_SWAGGER_UI"];
  const enabled =
    nodeEnv === "development" || swaggerFlag === "true";
  return NextResponse.json({ enabled });
}
