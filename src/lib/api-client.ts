import type {
  Bundle,
  BundleDetail,
  CreateCheckoutSessionResponse,
  DownloadResponse,
  EntitlementWithBundle,
} from "@/types/api";

interface ApiResponse<T> {
  data: T;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
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

export async function fetchEntitlements(token: string): Promise<EntitlementWithBundle[]> {
  const res = await apiFetch<ApiResponse<EntitlementWithBundle[]>>(
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
    { method: "POST", body: JSON.stringify({ bundle_id: bundleId }) },
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
