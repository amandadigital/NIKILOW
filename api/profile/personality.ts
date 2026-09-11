import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  readStoredProfiles,
  writeStoredProfiles,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const { userId, personality, authToken } = req.body || {};
    if (!userId || !personality) {
      res.status(400).json({ error: "userId and personality are required" });
      return;
    }

    // 1. Persist to server store
    const profiles = readStoredProfiles();
    const existing = profiles[userId] || {};
    const updated = {
      ...existing,
      id: userId,
      companion_name: personality.name,
      companion_prompt: personality.prompt,
      companion_avatar_url: personality.avatarUrl,
      companion_personality: personality,
      updated_at: new Date().toISOString(),
    };
    profiles[userId] = updated;
    writeStoredProfiles(profiles);

    // 2. Synchronize to Supabase profiles table in background
    (async () => {
      try {
        const headers: Record<string, string> = {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Authorization: authToken
            ? `Bearer ${authToken}`
            : `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: "return=representation",
        };

        const payload: Record<string, any> = {
          companion_name: personality.name,
          companion_prompt: personality.prompt,
          companion_avatar_url: personality.avatarUrl,
          companion_personality: personality,
          updated_at: new Date().toISOString(),
        };

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (e) {
        console.warn("Background Supabase personality sync notice:", e);
      }
    })();

    res.status(200).json({ success: true, personality, profile: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message || "Failed to save personality" });
  }
}
