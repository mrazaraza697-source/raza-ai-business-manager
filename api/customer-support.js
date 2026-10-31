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

    const safe = (value, max = 2000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      customerMessage,
      product,
      policy,
      tone,
      language
    } = req.body || {};

    const businessName = safe(business, 150);
    const message = safe(customerMessage, 4000);
    const productName = safe(product, 300);
    const businessPolicy = safe(policy, 2000);
    const replyTone = safe(tone, 100);
    const replyLanguage = safe(language, 100);

    if (!message) {
      return res.status(400).json({
        error: "Please provide the customer's message."
      });
    }

    const prompt = `
Prepare a helpful customer support reply.

Business: ${businessName || "Not specified"}
Product/service: ${productName || "Not specified"}
Customer message: ${message}
Business policies: ${businessPolicy || "Not provided"}
Reply tone: ${replyTone || "Friendly and professional"}
Reply language: ${replyLanguage || "Match the customer's language"}

Provide:
1. A ready-to-send customer reply.
2. A short explanation for the business owner if needed.
3. Any missing information that the business must confirm.

Important rules:
- Be polite, respectful and solution-focused.
- Never invent refunds, delivery dates, discounts, guarantees or policies.
- If information is missing, ask the customer or mark it for owner confirmation.
- Do not claim that a message has been sent.
- Do not request passwords, payment-card details or sensitive information.
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
              text: "You are RAZA TECH AI, a professional and helpful customer support assistant for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Customer support request failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty reply."
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
