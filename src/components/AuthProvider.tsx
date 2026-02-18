"use client";

import { KindeProvider } from "@kinde-oss/kinde-auth-react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const issuerUrl = process.env.NEXT_PUBLIC_KINDE_ISSUER_URL!;
  const clientId = process.env.NEXT_PUBLIC_KINDE_CLIENT_ID!;
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000";

  return (
    <KindeProvider
      domain={issuerUrl}
      clientId={clientId}
      redirectUri={siteUrl}
      logoutUri={siteUrl}
    >
      {children}
    </KindeProvider>
  );
}
