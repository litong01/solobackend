import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { env } from "../config/env";
import { AuthPayload } from "../types/api";

const jwksClient = jwksRsa({
  jwksUri: `${env.kinde.issuerUrl}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error("No signing key found"));
      resolve(key.getPublicKey());
    });
  });
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token format" });
      return;
    }

    const signingKey = await getSigningKey(decoded.header);

    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ["RS256"],
      issuer: env.kinde.issuerUrl,
    };
    if (env.kinde.audience) {
      verifyOptions.audience = env.kinde.audience;
    }

    const payload = jwt.verify(token, signingKey, verifyOptions) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}

/** Optional auth — sets req.user if token is present but doesn't require it */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header) return next();
    const signingKey = await getSigningKey(decoded.header);
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ["RS256"],
      issuer: env.kinde.issuerUrl,
    };
    if (env.kinde.audience) {
      verifyOptions.audience = env.kinde.audience;
    }
    req.user = jwt.verify(token, signingKey, verifyOptions) as AuthPayload;
  } catch {
    // Token invalid — continue without user
  }
  next();
}
