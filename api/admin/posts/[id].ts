import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, verifyAdminAuth } from "../../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed. Use DELETE." });
    return;
  }

  if (!verifyAdminAuth(req)) {
    res.status(401).json({
      error: "Unauthorized. Valid admin password or token required.",
    });
    return;
  }

  const id =
    (req.query.id as string) || req.url?.split("/").pop()?.split("?")[0];

  if (!id) {
    res.status(400).json({ error: "Post ID is required" });
    return;
  }

  try {
    // 1. Delete likes associated with post
    try {
      await supabaseAdmin.from("post_likes").delete().eq("post_id", id);
    } catch (likeErr) {
      console.warn("Delete likes notice:", likeErr);
    }

    // 2. Delete post row using service role
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);

    if (error) {
      console.error("Admin delete post error:", error);
      res.status(500).json({ error: error.message || "Failed to delete post" });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Post ${id} deleted successfully`,
      deletedId: id,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Admin delete post exception:", error);
    res.status(500).json({ error: error.message || "Server error deleting post" });
  }
}
