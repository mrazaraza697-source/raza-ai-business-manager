
import { createHmac, timingSafeEqual } from "node:crypto";

export const config = {
  api: {
    bodyParser: false
  }
};

function getQuery(req) {
  const url = new URL(req.url, "https://localhost");
  return url.searchParams;
}

async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function verifySignature(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  if (!signature.startsWith("sha256=")) return false;

  const received = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest();

  if (received.length !== expected.length) return false;

  return timingSafeEqual(received, expected);
}

async function supabaseRequest(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    console.error("Supabase error:", responseText);
    throw new Error("Could not save WhatsApp message.");
  }

  return responseText ? JSON.parse(responseText) : null;
}

async function saveIncomingMessage(message, contact, ownerUserId) {
  const customerNumber = message.from;
  const customerText = message.text?.body?.trim();

  if (!customerNumber || !customerText) return;

  const customerName = contact?.profile?.name || null;

  // Create or update customer.
  const customers = await supabaseRequest(
    "whatsapp_customers?on_conflict=user_id,phone_number",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        user_id: ownerUserId,
        phone_number: customerNumber,
        customer_name: customerName,
        updated_at: new Date().toISOString()
      })
    }
  );

  const customer = customers?.[0];

  if (!customer?.id) {
    throw new Error("Could not identify WhatsApp customer.");
  }

  // Find an existing open or pending conversation.
  const params = new URLSearchParams({
    select: "id",
    user_id: `eq.${ownerUserId}`,
    customer_id: `eq.${customer.id}`,
    status: "neq.closed",
    order: "updated_at.desc",
    limit: "1"
  });

  const conversations = await supabaseRequest(
    `whatsapp_conversations?${params.toString()}`
  );

  let conversation = conversations?.[0];

  // Create a conversation if none exists.
  if (!conversation?.id) {
    const created = await supabaseRequest(
      "whatsapp_conversations",
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          user_id: ownerUserId,
          customer_id: customer.id,
          status: "open",
          last_message: customerText,
          last_message_at: new Date().toISOString()
        })
      }
    );

    conversation = created?.[0];
  }

  if (!conversation?.id) {
    throw new Error("Could not create WhatsApp conversation.");
  }

  // Save incoming message. Duplicate Meta events are ignored.
  await supabaseRequest(
    "whatsapp_messages?on_conflict=user_id,whatsapp_message_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({
        user_id: ownerUserId,
        conversation_id: conversation.id,
        whatsapp_message_id: message.id || null,
        direction: "incoming",
        message_type: "text",
        message_text: customerText,
        delivery_status: "received"
      })
    }
  );

  // Update conversation's latest message.
  await supabaseRequest(
    `whatsapp_conversations?id=eq.${conversation.id}&user_id=eq.${ownerUserId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        last_message: customerText,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
}

export default async function handler(req, res) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Meta webhook verification.
  if (req.method === "GET") {
    const query = getQuery(req);

    const mode = query.get("hub.mode");
    const token = query.get("hub.verify_token");
    const challenge = query.get("hub.challenge");

    if (
      mode === "subscribe" &&
      verifyToken &&
      token === verifyToken &&
      challenge
    ) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Webhook verification failed.");
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    if (!appSecret) {
      return res.status(500).json({
        error: "WhatsApp App Secret is not configured."
      });
    }

    const ownerUserId = process.env.WHATSAPP_OWNER_USER_ID;

    if (!ownerUserId) {
      return res.status(500).json({
        error: "WhatsApp owner is not configured."
      });
    }

    const rawBody = await getRawBody(req);
    const signature = req.headers["x-hub-signature-256"];

    if (!verifySignature(rawBody, signature, appSecret)) {
      return res.status(401).json({
        error: "Invalid webhook signature."
      });
    }

    const payload = JSON.parse(rawBody.toString("utf8"));

    if (payload.object !== "whatsapp_business_account") {
      return res.status(404).json({
        error: "Unsupported webhook object."
      });
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;

        const value = change.value || [];
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messages) {
          // This first version saves text messages only.
          if (message.type !== "text") continue;

          const contact = contacts.find(
            item => item.wa_id === message.from
          );

          await saveIncomingMessage(
            message,
            contact,
            ownerUserId
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Incoming WhatsApp messages saved. No automatic reply was sent."
    });

  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);

    return res.status(500).json({
      error: "Webhook processing failed."
    });
  }
}
