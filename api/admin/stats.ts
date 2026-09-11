import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin, verifyAdminAuth } from "../_lib/supabaseAdmin";

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
      .select("id, user_id, author_username, likes_count, created_at, is_verified");

    if (error) {
      res.status(500).json({ error: error.message || "Failed to fetch stats" });
      return;
    }

    const totalPosts = posts?.length || 0;
    const uniqueAuthors = new Set(posts?.map((p) => p.author_username)).size;
    const totalLikes =
      posts?.reduce((acc, p) => acc + (p.likes_count || 0), 0) || 0;
    const verifiedPosts =
      posts?.filter(
        (p) => p.is_verified || p.author_username?.toLowerCase() === "kodewt"
      ).length || 0;

    res.status(200).json({
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
}
