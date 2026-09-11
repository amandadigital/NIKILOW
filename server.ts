import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

import type { VercelRequest, VercelResponse } from "@vercel/node";
import healthHandler from "./api/health";
import chatStreamHandler from "./api/chat/stream";
import adminLoginHandler from "./api/admin/login";
import adminVerifyHandler from "./api/admin/verify";
import adminLogoutHandler from "./api/admin/logout";
import adminPostsHandler from "./api/admin/posts/index";
import adminPostDeleteHandler from "./api/admin/posts/[id]";
import adminBulkDeleteHandler from "./api/admin/posts/bulk-delete";
import adminStatsHandler from "./api/admin/stats";
import profileGetHandler from "./api/profile/[userId]";
import profileUpdateHandler from "./api/profile/update";
import profilePersonalityHandler from "./api/profile/personality";
import postsHandler from "./api/posts/index";
import postCreateHandler from "./api/posts/create";
import postDeleteHandler from "./api/posts/delete";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Helper to adapt Express request/response to Vercel serverless function handler
function adapt(handler: (req: VercelRequest, res: VercelResponse) => any) {
  return (req: express.Request, res: express.Response) => {
    // Merge URL route params into query for complete Vercel query parameter parity
    if (req.params) {
      req.query = { ...req.query, ...req.params };
    }
    return handler(
      req as unknown as VercelRequest,
      res as unknown as VercelResponse
    );
  };
}

// ==============================================================================
// VERCEL API FUNCTIONS MOUNTED TO DEV / CONTAINER SERVER
// ==============================================================================
app.all("/api/health", adapt(healthHandler));
app.all("/api/chat/stream", adapt(chatStreamHandler));

// Admin Moderation API Endpoints
app.all("/api/admin/login", adapt(adminLoginHandler));
app.all("/api/admin/verify", adapt(adminVerifyHandler));
app.all("/api/admin/logout", adapt(adminLogoutHandler));
app.all("/api/admin/posts/bulk-delete", adapt(adminBulkDeleteHandler));
app.delete("/api/admin/posts/:id", adapt(adminPostDeleteHandler));
app.all("/api/admin/posts", adapt(adminPostsHandler));
app.all("/api/admin/stats", adapt(adminStatsHandler));

// Profile Endpoints
app.post("/api/profile/update", adapt(profileUpdateHandler));
app.post("/api/profile/personality", adapt(profilePersonalityHandler));
app.get("/api/profile/:userId", adapt(profileGetHandler));

// Post Endpoints
app.all("/api/posts/create", adapt(postCreateHandler));
app.all("/api/posts/delete", adapt(postDeleteHandler));
app.all("/api/posts", adapt(postsHandler));

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
