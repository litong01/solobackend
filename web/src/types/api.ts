export interface Bundle {
  id: string;
  title: string;
  description: string;
  price: number;
  metadata_url: string;
  created_at: string;
}

export interface BundleDetail extends Bundle {
  metadata: BundleMetadata | null;
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

export interface Entitlement {
  id: string;
  user_id: string;
  bundle_id: string;
  purchased_at: string;
  bundle: Bundle;
}

export interface ApiResponse<T> {
  data: T;
}

export interface CreateCheckoutSessionResponse {
  checkout_url: string;
}

export interface DownloadResponse {
  download_url: string;
  filename: string;
  expires_in: number;
}
