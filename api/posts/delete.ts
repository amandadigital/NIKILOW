import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed. Use POST or DELETE." });
    return;
  }

  try {
    const { postId, userId } = req.body || {};

    if (!postId) {
      res.status(400).json({ error: "postId is required" });
      return;
    }

    let query = supabaseAdmin.from("posts").delete().eq("id", postId);
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { error } = await query;
    if (error) {
      console.error("Failed to delete post via supabaseAdmin:", error);
      res.status(500).json({ error: error.message || "Failed to delete post" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    const error = err as Error;
    console.error("Delete post handler exception:", error);
    res.status(500).json({ error: error.message || "Server error deleting post" });
  }
}
