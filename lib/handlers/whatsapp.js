export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const safe = (value, max = 3000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      customerMessage,
      product,
      orderDetails,
      businessPolicies,
      language,
      tone,
      task
    } = req.body || {};

    const businessName = safe(business, 150);
    const message = safe(customerMessage, 4000);
    const productName = safe(product, 300);
    const orderInfo = safe(orderDetails, 1500);
    const policies = safe(businessPolicies, 2000);
    const replyLanguage = safe(language, 100);
    const replyTone = safe(tone, 100);
    const requestedTask = safe(task, 150);

    if (!message && !requestedTask) {
      return res.status(400).json({
        error: "Please provide a customer message or task."
      });
    }

    const prompt = `
Prepare a WhatsApp Business response or communication plan.

Business: ${businessName || "Not specified"}
Product/service: ${productName || "Not specified"}
Customer message: ${message || "No message supplied"}
Order details: ${orderInfo || "Not provided"}
Business policies: ${policies || "Not provided"}
Language: ${replyLanguage || "Match customer's language"}
Tone: ${replyTone || "Friendly and professional"}
Task: ${requestedTask || "Write a customer reply"}

Return:
1. A ready-to-send WhatsApp message.
2. A shorter version if useful.
3. Any information the business owner must confirm.

Rules:
- Keep messages clear, friendly and concise.
- Use WhatsApp-friendly formatting.
- Never invent prices, stock, delivery dates, refunds or policies.
- Never claim a message was sent or an order was processed.
- Do not request passwords, OTPs or payment-card details.
- Actual WhatsApp sending requires an authorized WhatsApp Business integration.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are RAZA TECH AI, a professional WhatsApp Business communication assistant for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 2500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "WhatsApp assistant request failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty response."
      });
    }

    return res.status(200).json({
      success: true,
      text: result
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
