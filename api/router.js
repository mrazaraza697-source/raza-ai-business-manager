
import advertisement from "../lib/handlers/advertisement.js";
import analytics from "../lib/handlers/analytics.js";
import assistant from "../lib/handlers/assistant.js";
import automation from "../lib/handlers/automation.js";
import content from "../lib/handlers/content.js";
import customerSupport from "../lib/handlers/customer-support.js";
import database from "../lib/handlers/database.js";
import email from "../lib/handlers/email.js";
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

export default async function handler(req, res) {
  const name = Array.isArray(req.query.handler)
    ? req.query.handler[0]
    : req.query.handler;

   if (!selectedHandler) {
    return res.status(404).json({
      error: "API route not found.",
      receivedHandler: name,
      availableHandlers: Object.keys(handlers)
    });
  }

  try {
    return await selectedHandler(req, res);
  } catch (error) {
    console.error("API router error:", error.message);

    return res.status(500).json({
      error: "Internal server error."
    });
  }
}
 
