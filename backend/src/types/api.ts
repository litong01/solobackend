export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  price: number;
  metadata_url: string;
  created_at: string;
}

export interface Entitlement {
  id: string;
  user_id: string;
  bundle_id: string;
  purchased_at: string;
}

export interface BundleWithOwnership extends Bundle {
  owned: boolean;
}

export interface EntitlementWithBundle extends Entitlement {
  bundle: Bundle;
}

export interface BundleMetadata {
  files: BundleFile[];
  preview_image?: string;
  composer?: string;
  genre?: string;
  difficulty?: string;
}

export interface BundleFile {
  key: string;
  filename: string;
  type: "pdf" | "musicxml" | "json";
  size_bytes: number;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface CreateCheckoutSessionRequest {
  bundle_id: string;
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string;
}

export interface DownloadResponse {
  download_url: string;
  filename: string;
  expires_in: number;
}

export interface AuthPayload {
  sub: string;
  email?: string;
  iss: string;
  aud?: string[];
}
