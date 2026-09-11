import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readStoredProfiles } from "../_lib/supabaseAdmin";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET." });
    return;
  }

  const userId =
    (req.query.userId as string) || req.url?.split("/").pop()?.split("?")[0];

  if (!userId) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  const profiles = readStoredProfiles();
  const cached = profiles[userId];
  if (cached) {
    res.status(200).json({ profile: cached });
    return;
  }

  res.status(200).json({ profile: null });
}
