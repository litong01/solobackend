export interface User {
  id: string;
  email: string;
  created_at: string;
  /** Stripe Connect Express account ID when creator has completed Connect onboarding. */
  stripe_connect_account_id?: string | null;
}

export interface Bundle {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  metadata_url: string | null;
  r2_key: string | null;
  created_by_user_id: string | null;
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
  /** Set when created from Stripe Checkout; used to revoke access on refund. */
  stripe_payment_intent_id?: string | null;
}

export interface EntitlementWithBundle extends Entitlement {
  bundle: Bundle;
}

export interface CreateCheckoutSessionRequest {
  bundle_id: string;
  /** Optional; when the JWT has no email claim, the client can send the user's email from Kinde profile. */
  email?: string;
}

export interface CreateCheckoutSessionResponse {
  /** Stripe Checkout URL when the bundle is paid; null when free (use free_claim). */
  checkout_url: string | null;
  /** True when the bundle is free and entitlement was granted without payment. */
  free_claim?: boolean;
}

export interface DownloadResponse {
  download_url: string;
  filename: string;
  expires_in: number;
}

/** One item in "My Collection": purchased, owned, or saved. */
export type CollectionItemType = "purchased" | "owned" | "saved";

export interface CollectionItem {
  bundle: Bundle;
  type: CollectionItemType;
  /** True if the user has purchased this bundle (entitlement). */
  purchased: boolean;
  /** True if the user has full access (purchased or created the bundle). Use this to show/hide locked sections. */
  unlocked: boolean;
  purchased_at?: string;
  added_at?: string;
}
