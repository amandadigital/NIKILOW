import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://pbvistgowxkhoifafuky.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAzOTEsImV4cCI6MjEwNDE4NjM5MX0.HFoWbRbzY2nFl-2hGDcr2-2r5oQNtIjb3B4FIFJLINM";

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidmlzdGdvd3hraG9pZmFmdWt5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODYxMDM5MSwiZXhwIjoyMTA0MTg2MzkxfQ.v4ApXT2agM5jJVnetl3j-PT5zzUwrZaIBJTrOsihpL0";

export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "RealKodewtAdminModeration67";

// Initialize Supabase Admin Client using service role key (bypasses RLS)
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Admin Session Tokens Store (in-memory per serverless instance or server process)
export const activeAdminTokens = new Set<string>();

// Helper to verify admin authentication across both Vercel and Express request objects
export function verifyAdminAuth(req: {
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const adminPasswordHeader = req.headers["x-admin-password"];
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.substring(7).trim()
      : null;

  const headerPass =
    typeof adminPasswordHeader === "string" ? adminPasswordHeader : undefined;

  return (
    headerPass === ADMIN_PASSWORD ||
    bearerToken === ADMIN_PASSWORD ||
    (Boolean(bearerToken) && activeAdminTokens.has(bearerToken!))
  );
}

// Resilient profiles storage (handles Vercel read-only filesystem via /tmp with bundled fallback)
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const PRIMARY_PROFILES_FILE = IS_VERCEL
  ? path.join("/tmp", "profiles.json")
  : path.join(process.cwd(), "data", "profiles.json");
const BUNDLED_PROFILES_FILE = path.join(process.cwd(), "data", "profiles.json");

export function readStoredProfiles(): Record<string, any> {
  try {
    if (fs.existsSync(PRIMARY_PROFILES_FILE)) {
      const data = fs.readFileSync(PRIMARY_PROFILES_FILE, "utf-8");
      return JSON.parse(data) || {};
    }
    if (fs.existsSync(BUNDLED_PROFILES_FILE)) {
      const data = fs.readFileSync(BUNDLED_PROFILES_FILE, "utf-8");
      return JSON.parse(data) || {};
    }
  } catch (err) {
    console.warn("readStoredProfiles notice:", err);
  }
  return {};
}

export function writeStoredProfiles(profiles: Record<string, any>) {
  try {
    const dir = path.dirname(PRIMARY_PROFILES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PRIMARY_PROFILES_FILE, JSON.stringify(profiles, null, 2), "utf-8");
  } catch (err) {
    // If permission or filesystem error, safely write to /tmp
    try {
      const tmpFile = path.join("/tmp", "profiles.json");
      fs.writeFileSync(tmpFile, JSON.stringify(profiles, null, 2), "utf-8");
    } catch (tmpErr) {
      console.warn("writeStoredProfiles notice:", tmpErr);
    }
  }
}
