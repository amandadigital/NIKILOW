import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, verifyAdminAuth } from "../../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  if (!verifyAdminAuth(req)) {
    res.status(401).json({
      error: "Unauthorized. Valid admin password or token required.",
    });
    return;
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array is required" });
    return;
  }

  try {
    // 1. Delete associated likes
    try {
      await supabaseAdmin.from("post_likes").delete().in("post_id", ids);
    } catch (likeErr) {
      console.warn("Bulk delete likes notice:", likeErr);
    }

    // 2. Delete posts
    const { error } = await supabaseAdmin.from("posts").delete().in("id", ids);

    if (error) {
      console.error("Admin bulk delete posts error:", error);
      res.status(500).json({ error: error.message || "Failed to bulk delete posts" });
      return;
    }

    res.status(200).json({
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
}
