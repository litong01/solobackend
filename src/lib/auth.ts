import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    const issuer = process.env.NEXT_PUBLIC_KINDE_ISSUER_URL;
    if (!issuer) throw new Error("NEXT_PUBLIC_KINDE_ISSUER_URL is not set");
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwks;
}

/**
 * Verify the Bearer token from the request and return the authenticated user.
 * Returns a NextResponse with 401 if authentication fails.
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthUser | NextResponse> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const token = header.slice(7);
  const issuer = process.env.NEXT_PUBLIC_KINDE_ISSUER_URL;

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: issuer || undefined,
    });

    const sub = payload.sub;
    if (!sub) {
      return NextResponse.json(
        { error: "unauthorized", message: "Token missing subject" },
        { status: 401 }
      );
    }

    return {
      id: sub,
      email: (payload as JWTPayload & { email?: string }).email ?? "",
    };
  } catch {
    return NextResponse.json(
      { error: "unauthorized", message: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

export function isAuthError(
  result: AuthUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
