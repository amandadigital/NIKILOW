import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "ok",
    name: "nikilow",
    platform: process.env.VERCEL ? "vercel" : "node",
    timestamp: new Date().toISOString(),
  });
}
