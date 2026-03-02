import type {
  Bundle,
  BundleDetail,
  CollectionItem,
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

export async function fetchCollection(token: string): Promise<CollectionItem[]> {
  const res = await apiFetch<ApiResponse<CollectionItem[]>>(
    "/api/collection",
    {},
    token
  );
  return res.data;
}

export async function checkCollectionStatus(
  bundleId: string,
  token: string
): Promise<{ saved: boolean }> {
  const res = await apiFetch<ApiResponse<{ saved: boolean }>>(
    `/api/collection/check?bundle_id=${encodeURIComponent(bundleId)}`,
    {},
    token
  );
  return res.data;
}

export async function addToCollection(bundleId: string, token: string): Promise<void> {
  await apiFetch(
    "/api/collection",
    {
      method: "POST",
      body: JSON.stringify({ bundle_id: bundleId }),
    },
    token
  );
}

export async function removeFromCollection(
  bundleId: string,
  token: string
): Promise<void> {
  const res = await fetch(`/api/collection/${bundleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `API error: ${res.status}`);
  }
}

export async function fetchMyBundles(token: string): Promise<Bundle[]> {
  const res = await apiFetch<ApiResponse<Bundle[]>>("/api/my-bundles", {}, token);
  return res.data;
}

export interface CreateBundleParams {
  title: string;
  description: string;
  price: number;
  category: string;
  file?: File | null;
}

export async function createBundle(
  token: string,
  params: CreateBundleParams
): Promise<Bundle> {
  const formData = new FormData();
  formData.set("title", params.title);
  formData.set("description", params.description);
  formData.set("price", String(params.price));
  formData.set("category", params.category ?? "");
  if (params.file) {
    formData.set("file", params.file);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch("/api/bundles", {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.data;
}

export async function createCheckoutSession(
  bundleId: string,
  token: string,
  email?: string | null
): Promise<CreateCheckoutSessionResponse> {
  const res = await apiFetch<ApiResponse<CreateCheckoutSessionResponse>>(
    "/api/purchase/create-checkout-session",
    {
      method: "POST",
      body: JSON.stringify({ bundle_id: bundleId, ...(email && { email }) }),
    },
    token
  );
  return res.data;
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

export async function deleteBundle(bundleId: string, token: string): Promise<void> {
  const res = await fetch(`/api/bundles/${bundleId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `API error: ${res.status}`);
  }
}

export interface UpdateBundleParams {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  file?: File | null;
}

export async function updateBundle(
  bundleId: string,
  token: string,
  params: UpdateBundleParams
): Promise<Bundle> {
  const hasFile = params.file && params.file.size > 0;
  if (hasFile) {
    const formData = new FormData();
    formData.set("title", params.title ?? "");
    formData.set("description", params.description ?? "");
    formData.set("price", String(params.price ?? ""));
    formData.set("category", params.category ?? "");
    formData.set("file", params.file!);
    const res = await fetch(`/api/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(body.message || `API error: ${res.status}`);
    }
    const data = await res.json();
    return data.data;
  }
  const res = await fetch(`/api/bundles/${bundleId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(params.title !== undefined && { title: params.title }),
      ...(params.description !== undefined && { description: params.description }),
      ...(params.price !== undefined && { price: params.price }),
      ...(params.category !== undefined && { category: params.category }),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data.data;
}

export interface ConnectStatus {
  has_account: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
}

export async function fetchConnectStatus(token: string): Promise<ConnectStatus> {
  const res = await apiFetch<ApiResponse<ConnectStatus>>(
    "/api/connect/status",
    {},
    token
  );
  return res.data;
}

/** Returns the URL to redirect the user to for Stripe Connect onboarding. */
export async function createConnectOnboardingUrl(token: string): Promise<string> {
  const res = await apiFetch<ApiResponse<{ url: string }>>(
    "/api/connect/onboard",
    { method: "POST" },
    token
  );
  return res.data.url;
}
