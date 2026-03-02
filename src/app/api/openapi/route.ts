import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Serves the OpenAPI spec as JSON for Swagger UI.
 * Prefers openapi.json (generated at build) so runtime does not need the yaml package.
 * Falls back to openapi.yaml + yaml parse for local dev.
 */
export async function GET() {
  const cwd = process.cwd();
  const jsonPath = join(cwd, "openapi.json");
  const yamlPath = join(cwd, "openapi.yaml");

  try {
    if (existsSync(jsonPath)) {
      const raw = readFileSync(jsonPath, "utf-8");
      const spec = JSON.parse(raw);
      return NextResponse.json(spec, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }
    const raw = readFileSync(yamlPath, "utf-8");
    const YAML = await import("yaml").then((m) => m.default);
    const spec = YAML.parse(raw);
    return NextResponse.json(spec, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    console.error("Failed to load OpenAPI spec:", err);
    return NextResponse.json(
      { error: "openapi_unavailable", message: "OpenAPI spec not found" },
      { status: 500 }
    );
  }
}
