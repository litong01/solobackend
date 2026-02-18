"use client";

import { useKindeAuth } from "@kinde-oss/kinde-auth-react";

/**
 * Safe wrapper around useKindeAuth that doesn't throw during
 * server-side static generation (where KindeProvider doesn't exist).
 */
export function useAuth() {
  try {
    return useKindeAuth();
  } catch {
    return {
      isAuthenticated: false,
      isLoading: true,
      user: null,
      login: () => {},
      logout: () => {},
      getToken: async () => null as string | null,
    };
  }
}
