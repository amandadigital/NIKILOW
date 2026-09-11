import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const {
      content,
      userId,
      authorName,
      authorUsername,
      authorAvatar,
      isVerified,
    } = req.body || {};

    const trimmed = (content || "").trim();
    if (!trimmed) {
      res.status(400).json({ error: "Post content cannot be empty" });
      return;
    }

    if (trimmed.length > 300) {
      res.status(400).json({ error: "Post cannot exceed 300 characters" });
      return;
    }

    if (!userId || !authorUsername) {
      res.status(400).json({ error: "userId and authorUsername are required" });
      return;
    }

    const isKodewt =
      authorUsername.toLowerCase() === "kodewt" ||
      authorUsername.toLowerCase() === "@kodewt";

    // Insert into posts table using supabaseAdmin (bypasses RLS issues)
    const { data: insertedPost, error } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: userId,
        author_name: authorName || authorUsername,
        author_username: authorUsername.replace(/^@/, ""),
        author_avatar: authorAvatar || "",
        content: trimmed,
        likes_count: 0,
        is_verified: isKodewt || Boolean(isVerified),
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to insert post via supabaseAdmin:", error);
      res.status(500).json({ error: error.message || "Database insert failed" });
      return;
    }

    res.status(201).json({
      success: true,
      post: {
        id: insertedPost.id,
        userId: insertedPost.user_id,
        authorName: insertedPost.author_name || insertedPost.author_username,
        authorUsername: insertedPost.author_username,
        authorAvatar: insertedPost.author_avatar || "",
        content: insertedPost.content,
        createdAt: new Date(insertedPost.created_at).getTime(),
        likesCount: insertedPost.likes_count || 0,
        isLiked: false,
        isVerified: insertedPost.is_verified || isKodewt,
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error("Create post handler exception:", error);
    res.status(500).json({ error: error.message || "Server error creating post" });
  }
}
