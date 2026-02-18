import { Request, Response } from "express";
import * as entitlementService from "../services/entitlement.service";

export async function listEntitlements(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.sub;
    const entitlements = await entitlementService.getUserEntitlements(userId);
    res.json({ data: entitlements });
  } catch (err) {
    console.error("Error listing entitlements:", err);
    res.status(500).json({ error: "server_error", message: "Failed to list entitlements" });
  }
}
