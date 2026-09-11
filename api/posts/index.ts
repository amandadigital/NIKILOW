import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed. Use GET." });
    return;
  }

  try {
    const { data: dbPosts, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch posts via supabaseAdmin:", error);
      res.status(500).json({ error: error.message || "Failed to fetch posts" });
      return;
    }

    const posts = (dbPosts || []).map((p) => {
      const isKodewt = p.author_username?.toLowerCase() === "kodewt";
      return {
        id: p.id,
        userId: p.user_id,
        authorName: p.author_name || p.author_username,
        authorUsername: p.author_username,
        authorAvatar: p.author_avatar || "",
        content: p.content,
        createdAt: new Date(p.created_at).getTime(),
        likesCount: p.likes_count || 0,
        isLiked: false,
        isVerified: p.is_verified || isKodewt,
      };
    });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Get posts handler exception:", error);
    res.status(500).json({ error: error.message || "Server error fetching posts" });
  }
}
