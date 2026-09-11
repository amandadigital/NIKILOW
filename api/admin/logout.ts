import type { VercelRequest, VercelResponse } from "@vercel/node";
import { activeAdminTokens } from "../_lib/supabaseAdmin";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : null;

  if (bearerToken) {
    activeAdminTokens.delete(bearerToken);
  }

  res.status(200).json({ success: true, message: "Logged out from admin" });
}
