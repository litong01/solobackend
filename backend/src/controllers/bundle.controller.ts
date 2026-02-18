import { Request, Response } from "express";
import * as bundleService from "../services/bundle.service";
import * as entitlementService from "../services/entitlement.service";

export async function listBundles(req: Request, res: Response): Promise<void> {
  try {
    const bundles = await bundleService.listBundles();
    res.json({ data: bundles });
  } catch (err) {
    console.error("Error listing bundles:", err);
    res.status(500).json({ error: "server_error", message: "Failed to list bundles" });
  }
}

export async function getBundle(req: Request, res: Response): Promise<void> {
  try {
    const bundle = await bundleService.getBundleById(req.params.id);
    if (!bundle) {
      res.status(404).json({ error: "not_found", message: "Bundle not found" });
      return;
    }

    let metadata = null;
    if (bundle.metadata_url) {
      metadata = await bundleService.getBundleMetadata(bundle.metadata_url);
    }

    res.json({ data: { ...bundle, metadata } });
  } catch (err) {
    console.error("Error getting bundle:", err);
    res.status(500).json({ error: "server_error", message: "Failed to get bundle" });
  }
}

export async function downloadBundle(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.sub;
    const bundleId = req.params.id;

    const owns = await entitlementService.userOwnsBundle(userId, bundleId);
    if (!owns) {
      res.status(403).json({ error: "forbidden", message: "You do not own this bundle" });
      return;
    }

    const bundle = await bundleService.getBundleById(bundleId);
    if (!bundle) {
      res.status(404).json({ error: "not_found", message: "Bundle not found" });
      return;
    }

    const metadata = await bundleService.getBundleMetadata(bundle.metadata_url);
    if (!metadata?.files?.length) {
      res.status(404).json({ error: "not_found", message: "No files found for this bundle" });
      return;
    }

    const fileParam = req.query.file as string | undefined;
    const file = fileParam
      ? metadata.files.find((f) => f.key === fileParam)
      : metadata.files[0];

    if (!file) {
      res.status(404).json({ error: "not_found", message: "Requested file not found in bundle" });
      return;
    }

    const expiresIn = 300;
    const downloadUrl = await bundleService.generateDownloadUrl(file.key, expiresIn);

    res.json({
      data: {
        download_url: downloadUrl,
        filename: file.filename,
        expires_in: expiresIn,
      },
    });
  } catch (err) {
    console.error("Error generating download URL:", err);
    res.status(500).json({ error: "server_error", message: "Failed to generate download URL" });
  }
}
