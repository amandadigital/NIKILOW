import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminAuth } from "../_lib/supabaseAdmin";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET." });
    return;
  }

  if (!verifyAdminAuth(req)) {
    res.status(401).json({
      error: "Unauthorized. Valid admin password or token required.",
    });
    return;
  }

  res.status(200).json({ success: true, authenticated: true });
}
