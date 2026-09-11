import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { ADMIN_PASSWORD, activeAdminTokens } from "../_lib/supabaseAdmin";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const { password } = req.body || {};
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  if (password.trim() !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  activeAdminTokens.add(token);

  res.status(200).json({
    success: true,
    message: "Admin authenticated successfully",
    token,
  });
}
