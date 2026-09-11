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
    const { userId, profile, authToken } = req.body || {};
    if (!userId || !profile) {
      res.status(400).json({ error: "userId and profile are required" });
      return;
    }

    // 1. Immediately persist to server storage
    const profiles = readStoredProfiles();
    const existing = profiles[userId] || {};
    const updated = {
      ...existing,
      ...profile,
      id: userId,
      updated_at: new Date().toISOString(),
    };
    profiles[userId] = updated;
    writeStoredProfiles(profiles);

    // 2. Forward to Supabase database from server if applicable
    (async () => {
      try {
        const headers: Record<string, string> = {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          Authorization: authToken
            ? `Bearer ${authToken}`
            : `Bearer ${SUPABASE_ANON_KEY}`,
        };

        const payload: Record<string, any> = {
          id: userId,
          name: updated.name || updated.username || "User",
          username: updated.username || "user",
          bio: updated.bio || "",
          updated_at: updated.updated_at,
        };
        if (updated.avatar_url && updated.avatar_url.length < 50000) {
          payload.avatar_url = updated.avatar_url;
        }
        if (updated.companion_name) {
          payload.companion_name = updated.companion_name;
        }
        if (updated.companion_prompt) {
          payload.companion_prompt = updated.companion_prompt;
        }
        if (updated.companion_avatar_url) {
          payload.companion_avatar_url = updated.companion_avatar_url;
        }
        if (updated.companion_personality) {
          payload.companion_personality = updated.companion_personality;
        }

        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (err) {
        console.warn("Supabase background sync skipped:", err);
      }
    })();

    res.status(200).json({ success: true, profile: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
}
