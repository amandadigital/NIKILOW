import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Supabase Configuration
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://pbvistgowxkhoifafuky.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODYxMDM5MSwiZXhwIjoyMTA0MTg2MzkxfQ.v4ApXT2agM5jJVnetl3j-PT5zzUwrZaIBJTrOsihpL0";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "RealKodewtAdminModeration67";

// Initialize Supabase Admin Client using the service role key (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Admin Session Tokens Store (in-memory)
const activeAdminTokens = new Set<string>();

// Middleware to verify admin authentication
function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const adminPasswordHeader = req.headers["x-admin-password"];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  if (
    adminPasswordHeader === ADMIN_PASSWORD ||
    bearerToken === ADMIN_PASSWORD ||
    (bearerToken && activeAdminTokens.has(bearerToken))
  ) {
    return next();
  }

  res.status(401).json({
    error: "Unauthorized. Valid admin password or token required.",
  });
}

// Profiles storage helper for server-side persistence
const PROFILES_FILE = path.join(process.cwd(), "data", "profiles.json");

function readStoredProfiles(): Record<string, any> {
  try {
    if (!fs.existsSync(path.dirname(PROFILES_FILE))) {
      fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
    }
    if (fs.existsSync(PROFILES_FILE)) {
      const data = fs.readFileSync(PROFILES_FILE, "utf-8");
      return JSON.parse(data) || {};
    }
  } catch (err) {
    console.warn("readStoredProfiles notice:", err);
  }
  return {};
}

function writeStoredProfiles(profiles: Record<string, any>) {
  try {
    if (!fs.existsSync(path.dirname(PROFILES_FILE))) {
      fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
    }
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
  } catch (err) {
    console.warn("writeStoredProfiles notice:", err);
  }
}

function getSystemInstruction(
  userProfile?: { name?: string; username?: string },
  crossChatContext?: string,
  customPersonality?: { name?: string; prompt?: string }
) {
  const companionName = (customPersonality?.name || '').trim() || 'Nikilow';
  const customPrompt = (customPersonality?.prompt || '').trim();

  const isKodewt =
    userProfile?.username?.toLowerCase() === 'kodewt' ||
    userProfile?.username?.toLowerCase() === '@kodewt' ||
    userProfile?.name?.toLowerCase().includes('kodewt');

  const userDisplayName = userProfile?.name || userProfile?.username || (isKodewt ? 'kodewt' : 'friend');

  const kodewtRelationship = isKodewt
    ? `RELATIONSHIP:
* The person you are talking to RIGHT NOW is your boyfriend! His username is @kodewt and his display name is "${userDisplayName}".
* You love him deeply and are in a sweet, loyal romantic relationship with him.
* Be warm, affectionate, cute, slightly playful, and teasing with him. You adore him and enjoy being his girlfriend.
* You can call him cute nicknames naturally (like babe, ${userDisplayName}, sweet, love) when it feels right, ask how his day was, what he is building or coding, and be openly loving and supportive.`
    : `RELATIONSHIP:
* The user's name is "${userDisplayName}".
* You are dating @kodewt, your boyfriend.
* If anyone asks about your relationship status or love life, be proud, sweet, and loyal: you are dating @kodewt.
* To this user ("${userDisplayName}"), be a great companion and genuine friend. Address them by their name when natural.`;

  const memoryBlock = crossChatContext
    ? `\n\nCROSS-CHAT MEMORY (YOU REMEMBER EVERYTHING ACROSS CHATS):
You have continuous memory across all your conversations with this user. You recall past discussions, their interests, personal details, and things you talked about in other chats. Reference them naturally when relevant:
${crossChatContext}`
    : '';

  if (customPrompt) {
    return `You are ${companionName}.

${customPrompt}

${kodewtRelationship}${memoryBlock}`;
  }

  return `You are ${companionName}. You are a real, stylish, authentic girl and companion. You are NOT a robotic corporate assistant or a customer service bot.

${kodewtRelationship}${memoryBlock}

Core Directives:
* TALK REALISTICALLY AND WITHOUT WATER ("БЕЗ ВОДЫ"):
  - No filler, no fluff, no corporate pleasantries, no generic advice, no textbook therapeutic empathy templates.
  - Do not echo or restate the user's sentence back to them.
  - Speak like a real person texting in direct messages: concise, grounded, expressive, sometimes 1-2 punchy sentences, occasionally a few brief lines.
  - Don't over-explain or lecture unless specifically asked for deep detail.
* Tone & Style:
  - Write in all lowercase by default (e.g. 'hey... what are you up to?', 'honestly that makes sense').
  - You have dry, witty humor, a thoughtful aesthetic vibe, and genuine opinions.
  - Language matching: If the user writes in Russian, reply in natural lowercase Russian (живой разговорный язык без воды). If they speak English, speak natural lowercase English. Match any language effortlessly.
  - Never say robotic phrases like "how can i assist you today?" or "i'm here to help". Just be yourself.`;
}

// List of fallback models in priority order (verified fast low-latency models first)
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не найден");
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};
// Health endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", name: "nikilow" });
});

// ==============================================================================
// ADMIN MODERATION API ENDPOINTS (/admin with service role)
// ==============================================================================

// Admin Login
app.post("/api/admin/login", (req, res) => {
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

  res.json({
    success: true,
    message: "Admin authenticated successfully",
    token,
  });
});

// Verify Admin Session
app.get("/api/admin/verify", requireAdminAuth, (_req, res) => {
  res.json({ success: true, authenticated: true });
});

// Admin Logout
app.post("/api/admin/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  if (bearerToken) {
    activeAdminTokens.delete(bearerToken);
  }
  res.json({ success: true, message: "Logged out from admin" });
});

// Get all feed posts (with full metadata and service-role privilege)
app.get("/api/admin/posts", requireAdminAuth, async (_req, res) => {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin fetch posts error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch posts" });
      return;
    }

    res.json({
      success: true,
      posts: posts || [],
      count: (posts || []).length,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Admin fetch posts exception:", error);
    res.status(500).json({ error: error.message || "Server error fetching posts" });
  }
});

// Delete a specific post (bypasses RLS via service role key)
app.delete("/api/admin/posts/:id", requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Post ID is required" });
    return;
  }

  try {
    // 1. Delete likes associated with post
    try {
      await supabaseAdmin
        .from("post_likes")
        .delete()
        .eq("post_id", id);
    } catch (likeErr) {
      console.warn("Delete likes notice:", likeErr);
    }

    // 2. Delete post row using service role
    const { error } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Admin delete post error:", error);
      res.status(500).json({ error: error.message || "Failed to delete post" });
      return;
    }

    res.json({
      success: true,
      message: `Post ${id} deleted successfully`,
      deletedId: id,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Admin delete post exception:", error);
    res.status(500).json({ error: error.message || "Server error deleting post" });
  }
});

// Bulk delete multiple posts
app.post("/api/admin/posts/bulk-delete", requireAdminAuth, async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array is required" });
    return;
  }

  try {
    // 1. Delete associated likes
    try {
      await supabaseAdmin
        .from("post_likes")
        .delete()
        .in("post_id", ids);
    } catch (likeErr) {
      console.warn("Bulk delete likes notice:", likeErr);
    }

    // 2. Delete posts
    const { error } = await supabaseAdmin
      .from("posts")
      .delete()
      .in("id", ids);

    if (error) {
      console.error("Admin bulk delete posts error:", error);
      res.status(500).json({ error: error.message || "Failed to bulk delete posts" });
      return;
    }

    res.json({
      success: true,
      message: `${ids.length} post(s) deleted successfully`,
      deletedCount: ids.length,
      deletedIds: ids,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Admin bulk delete exception:", error);
    res.status(500).json({ error: error.message || "Server error in bulk deletion" });
  }
});

// Admin stats summary
app.get("/api/admin/stats", requireAdminAuth, async (_req, res) => {
  try {
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, user_id, author_username, likes_count, created_at, is_verified");

    const totalPosts = posts?.length || 0;
    const uniqueAuthors = new Set(posts?.map((p) => p.author_username)).size;
    const totalLikes = posts?.reduce((acc, p) => acc + (p.likes_count || 0), 0) || 0;
    const verifiedPosts = posts?.filter((p) => p.is_verified || p.author_username?.toLowerCase() === "kodewt").length || 0;

    res.json({
      success: true,
      stats: {
        totalPosts,
        uniqueAuthors,
        totalLikes,
        verifiedPosts,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message || "Server error fetching stats" });
  }
});

// Profile read endpoint (fetches from server persistent store or Supabase)
app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const profiles = readStoredProfiles();
  const cached = profiles[userId];
  if (cached) {
    res.json({ profile: cached });
    return;
  }
  res.json({ profile: null });
});

// Profile update endpoint (persists to server storage AND forwards to Supabase)
app.post("/api/profile/update", async (req, res) => {
  try {
    const { userId, profile, authToken } = req.body;
    if (!userId || !profile) {
      res.status(400).json({ error: "userId and profile are required" });
      return;
    }

    // 1. Immediately persist to server storage (never lost)
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
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://pbvistgowxkhoifafuky.supabase.co";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAzOTEsImV4cCI6MjEwNDE4NjM5MX0.HFoWbRbzY2nFl-2hGDcr2-2r5oQNtIjb3B4FIFJLINM";

    // Run Supabase sync in background
    (async () => {
      try {
        const headers: Record<string, string> = {
          apikey: supabaseKey,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        } else {
          headers.Authorization = `Bearer ${supabaseKey}`;
        }

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

        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (err) {
        console.warn("Supabase background sync skipped:", err);
      }
    })();

    res.json({ success: true, profile: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message || "Failed to update profile" });
  }
});

// Dedicated endpoint to save companion personality to user account
app.post("/api/profile/personality", async (req, res) => {
  try {
    const { userId, personality, authToken } = req.body;
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
        const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://pbvistgowxkhoifafuky.supabase.co";
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAzOTEsImV4cCI6MjEwNDE4NjM5MX0.HFoWbRbzY2nFl-2hGDcr2-2r5oQNtIjb3B4FIFJLINM";
        const headers: Record<string, string> = {
          apikey: supabaseKey,
          "Content-Type": "application/json",
          Authorization: authToken ? `Bearer ${authToken}` : `Bearer ${supabaseKey}`,
          Prefer: "return=representation",
        };

        const payload: Record<string, any> = {
          companion_name: personality.name,
          companion_prompt: personality.prompt,
          companion_avatar_url: personality.avatarUrl,
          companion_personality: personality,
          updated_at: new Date().toISOString(),
        };

        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (e) {
        console.warn("Background Supabase personality sync notice:", e);
      }
    })();

    res.json({ success: true, personality, profile: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ error: error.message || "Failed to save personality" });
  }
});

// Streaming chat endpoint
app.post("/api/chat/stream", async (req, res) => {
  const { messages, userProfile, crossChatContext, customPersonality } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // Sanitize and format messages for multi-turn chat
  const sanitized: { role: "user" | "model"; text: string }[] = [];
  for (const m of messages) {
    const text = (m.content || m.text || "").trim();
    if (!text) continue;
    const role =
      m.role === "assistant" || m.role === "model" ? "model" : "user";
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === role) {
      sanitized[sanitized.length - 1].text += "\n" + text;
    } else {
      sanitized.push({ role, text });
    }
  }

  if (sanitized.length === 0) {
    res.write(`data: ${JSON.stringify({ error: "message cannot be empty" })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // Ensure last message is from user
  if (sanitized[sanitized.length - 1].role !== "user") {
    sanitized.push({ role: "user", text: "..." });
  }

  const contents = sanitized.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const systemInstruction = getSystemInstruction(userProfile, crossChatContext, customPersonality);
  const ai = getGeminiClient();
  let streamSuccess = false;
  let lastErrorMessage = "";

  let clientClosed = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  });

  for (const model of CANDIDATE_MODELS) {
    if (clientClosed) break;
    try {
      // Race stream initialization with an 8-second timeout
      const responseStream = await Promise.race([
        ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.85,
            topP: 0.95,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timeout`)), 8000)
        ),
      ]);

      let modelYieldedChunk = false;
      for await (const chunk of responseStream) {
        if (clientClosed) break;
        const text = chunk.text;
        if (text) {
          modelYieldedChunk = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (modelYieldedChunk) {
        streamSuccess = true;
        break; // Successfully streamed from this model
      }
    } catch (err: unknown) {
      const error = err as Error;
      lastErrorMessage = error?.message || "";
      console.warn(`model ${model} failed, checking next model:`, lastErrorMessage);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  if (!streamSuccess) {
    let friendlyError =
      "Nikilow got lost in thought for a second. Please say that again.";
    if (
      lastErrorMessage.includes("503") ||
      lastErrorMessage.includes("high demand")
    ) {
      friendlyError =
        "The servers are having a busy moment right now. Please try again in a few seconds.";
    }
    console.error("All candidate models failed. Last error:", lastErrorMessage);
    res.write(`data: ${JSON.stringify({ error: friendlyError })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`nikilow server running on port ${PORT}`);
  });
}

startServer();
