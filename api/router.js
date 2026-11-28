import advertisement from "../lib/handlers/advertisement.js";
import analytics from "../lib/handlers/analytics.js";
import assistant from "../lib/handlers/assistant.js";
import automation from "../lib/handlers/automation.js";
import content from "../lib/handlers/content.js";
import customerSupport from "../lib/handlers/customer-support.js";
import database from "../lib/handlers/database.js";
import email from "../lib/handlers/email.js";
import facebookOAuth from "../lib/handlers/facebook-oauth.js";
import health from "../lib/handlers/health.js";
import integrations from "../lib/handlers/integrations.js";
import notifications from "../lib/handlers/notifications.js";
import products from "../lib/handlers/products.js";
import reports from "../lib/handlers/reports.js";
import scheduler from "../lib/handlers/scheduler.js";
import seo from "../lib/handlers/seo.js";
import socialMedia from "../lib/handlers/social-media.js";
import strategy from "../lib/handlers/strategy.js";
import tasks from "../lib/handlers/tasks.js";
import video from "../lib/handlers/video.js";
import whatsapp from "../lib/handlers/whatsapp.js";
import whatsappWebhook from "./whatsapp-webhook.js";

export const config = { api: { bodyParser: false } };

// Best-effort per-instance rate limiter; not a globally shared limit.
const RATE_WINDOW_MS = 60000;
const RATE_LIMIT = 30;
const rateBuckets = new Map();
const MAX_BODY_BYTES = 1024 * 1024;

function rateLimitUser(userId) {
  const now = Date.now();
  let bucket = rateBuckets.get(userId);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) bucket = { start: now, count: 0 };
  bucket.count++;
  rateBuckets.set(userId, bucket);
  if (rateBuckets.size > 1000) {
    for (const [id, entry] of rateBuckets) if (now - entry.start >= RATE_WINDOW_MS) rateBuckets.delete(id);
  }
  return bucket.count <= RATE_LIMIT;
}

const handlers = {
  advertisement, analytics, assistant, automation, content,
  "customer-support": customerSupport, database, email,
  "facebook-oauth": facebookOAuth, health, integrations,
  notifications, products, reports, scheduler, seo,
  "social-media": socialMedia, strategy, tasks, video, whatsapp,
  "whatsapp-webhook": whatsappWebhook
};

async function parseJsonBody(req) {
  if (req.body !== undefined) return;
  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error("Request body too large.");
    error.statusCode = 413;
    throw error;
  }
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  const rawBody = Buffer.concat(chunks, totalBytes).toString("utf8");
  if (!rawBody.trim()) { req.body = {}; return; }
  try { req.body = JSON.parse(rawBody); }
  catch { throw new Error("Invalid JSON request body."); }
}

async function verifyUser(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase server configuration is missing.");
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return await response.json();
}

export default async function handler(req, res) {
  const name = Array.isArray(req.query.handler) ? req.query.handler[0] : req.query.handler;
  const selectedHandler = handlers[name];
  if (!selectedHandler) return res.status(404).json({ error: "API route not found." });
  try {
    if (name !== "whatsapp-webhook") await parseJsonBody(req);
    // Public callback: its one-time signed state is validated by the OAuth handler.
    if (name === "facebook-oauth" && String(req.query.action || "") === "callback" && req.method === "GET") {
      return await selectedHandler(req, res);
    }
    if (name === "health" || name === "whatsapp-webhook") return await selectedHandler(req, res);
    const user = await verifyUser(req);
    if (!user || !user.id) return res.status(401).json({ error: "Unauthorized. Please login again." });
    if (!rateLimitUser(user.id)) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Too many API requests. Please wait a minute and try again." });
    }
    req.user = user;
    return await selectedHandler(req, res);
  } catch (error) {
    console.error("API router error:", error);
    if (error.statusCode === 413) return res.status(413).json({ error: "Request body too large (1 MB maximum)." });
    if (error.message === "Invalid JSON request body.") return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: "Internal server error." });
  }
}
