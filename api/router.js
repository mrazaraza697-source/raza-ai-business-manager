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

export const config = {
  api: {
    bodyParser: false
  }
};

const handlers = {
  advertisement,
  analytics,
  assistant,
  automation,
  content,
  "customer-support": customerSupport,
  database,
  email,
  "facebook-oauth": facebookOAuth,
  health,
  integrations,
  notifications,
  products,
  reports,
  scheduler,
  seo,
  "social-media": socialMedia,
  strategy,
  tasks,
  video,
  whatsapp,
  "whatsapp-webhook": whatsappWebhook
};

async function parseJsonBody(req) {
  if (req.body !== undefined) return;

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    );
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!rawBody.trim()) {
    req.body = {};
    return;
  }

  try {
    req.body = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON request body.");
  }
}

async function verifyUser(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) return null;

  const response = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        "apikey": publishableKey,
        "Authorization": `Bearer ${token}`
      }
    }
  );

  if (!response.ok) return null;

  return await response.json();
}

export default async function handler(req, res) {
  const name = Array.isArray(req.query.handler)
    ? req.query.handler[0]
    : req.query.handler;

  const selectedHandler = handlers[name];

  if (!selectedHandler) {
    return res.status(404).json({
      error: "API route not found."
    });
  }

  try {
    if (name !== "whatsapp-webhook") {
      await parseJsonBody(req);
    }

    // Public callback: its one-time signed state is validated by the OAuth handler.
    if (
      name === "facebook-oauth" &&
      String(req.query.action || "") === "callback" &&
      req.method === "GET"
    ) {
      return await selectedHandler(req, res);
    }

    if (name === "health") {
      return await selectedHandler(req, res);
    }

    if (name === "whatsapp-webhook") {
      return await selectedHandler(req, res);
    }

    const user = await verifyUser(req);

    if (!user || !user.id) {
      return res.status(401).json({
        error: "Unauthorized. Please login again."
      });
    }

    req.user = user;

    return await selectedHandler(req, res);

  } catch (error) {
    console.error("API router error:", error);

    if (error.message === "Invalid JSON request body.") {
      return res.status(400).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error: "Internal server error."
    });
  }
}
