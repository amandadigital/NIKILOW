import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getGeminiClient,
  CANDIDATE_MODELS,
  getSystemInstruction,
} from "../_lib/gemini";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const { messages, userProfile, crossChatContext, customPersonality } =
    req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Set SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

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

  const systemInstruction = getSystemInstruction(
    userProfile,
    crossChatContext,
    customPersonality
  );
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

  if (!streamSuccess && !clientClosed) {
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
}
