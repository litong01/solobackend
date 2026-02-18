import {
  ApiResponse,
  Bundle,
  BundleDetail,
  CreateCheckoutSessionResponse,
  DownloadResponse,
  Entitlement,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchBundles(): Promise<Bundle[]> {
  const res = await apiFetch<ApiResponse<Bundle[]>>("/api/bundles");
  return res.data;
}

export async function fetchBundle(id: string): Promise<BundleDetail> {
  const res = await apiFetch<ApiResponse<BundleDetail>>(`/api/bundles/${id}`);
  return res.data;
}

export async function fetchEntitlements(token: string): Promise<Entitlement[]> {
  const res = await apiFetch<ApiResponse<Entitlement[]>>(
    "/api/entitlements",
    {},
    token
  );
  return res.data;
}

export async function createCheckoutSession(
  bundleId: string,
  token: string
): Promise<string> {
  const res = await apiFetch<ApiResponse<CreateCheckoutSessionResponse>>(
    "/api/purchase/create-checkout-session",
    {
      method: "POST",
      body: JSON.stringify({ bundle_id: bundleId }),
    },
    token
  );
  return res.data.checkout_url;
}

export async function fetchDownloadUrl(
  bundleId: string,
  token: string,
  fileKey?: string
): Promise<DownloadResponse> {
  const params = fileKey ? `?file=${encodeURIComponent(fileKey)}` : "";
  const res = await apiFetch<ApiResponse<DownloadResponse>>(
    `/api/bundles/${bundleId}/download${params}`,
    {},
    token
  );
  return res.data;
}
