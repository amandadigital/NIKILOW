import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, verifyAdminAuth } from "../../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    res.status(200).json({
      success: true,
      posts: posts || [],
      count: (posts || []).length,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Admin fetch posts exception:", error);
    res.status(500).json({ error: error.message || "Server error fetching posts" });
  }
}
