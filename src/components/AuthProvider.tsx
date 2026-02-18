"use client";

import { KindeProvider } from "@kinde-oss/kinde-auth-react";

function getConfig() {
  // In the browser, check for runtime config injected via <script> tag first,
  // then fall back to NEXT_PUBLIC_ build-time values.
  if (typeof window !== "undefined") {
    const rt = (window as unknown as Record<string, unknown>).__ENV as
      | Record<string, string>
      | undefined;
    return {
      issuerUrl:
        rt?.NEXT_PUBLIC_KINDE_ISSUER_URL ||
        process.env.NEXT_PUBLIC_KINDE_ISSUER_URL ||
        "",
      clientId:
        rt?.NEXT_PUBLIC_KINDE_CLIENT_ID ||
        process.env.NEXT_PUBLIC_KINDE_CLIENT_ID ||
        "",
      siteUrl: window.location.origin,
    };
  }
  return {
    issuerUrl: process.env.NEXT_PUBLIC_KINDE_ISSUER_URL || "",
    clientId: process.env.NEXT_PUBLIC_KINDE_CLIENT_ID || "",
    siteUrl: "http://localhost:3000",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { issuerUrl, clientId, siteUrl } = getConfig();

  if (!issuerUrl || !clientId) {
    return <>{children}</>;
  }

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
