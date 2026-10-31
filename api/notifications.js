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
      notificationType,
      event,
      recipient,
      channel,
      tone,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const type = safe(notificationType, 150);
    const eventDetails = safe(event, 1000);
    const recipientType = safe(recipient, 200);
    const deliveryChannel = safe(channel, 100);
    const messageTone = safe(tone, 100);
    const extraDetails = safe(details, 2000);

    if (!eventDetails && !extraDetails) {
      return res.status(400).json({
        error: "Please provide notification details."
      });
    }

    const prompt = `
Create a professional business notification.

Business: ${businessName || "RAZA TECHNOLOGIES AI"}
Notification type: ${type || "Business alert"}
Event: ${eventDetails || "Not specified"}
Recipient: ${recipientType || "Business owner"}
Channel: ${deliveryChannel || "Suitable channel"}
Tone: ${messageTone || "Clear and professional"}
Extra details: ${extraDetails || "None"}

Return:
1. Notification title.
2. Short notification message.
3. Suggested priority: low, normal, high or urgent.
4. Recommended recipient.
5. Suggested delivery channel.
6. Suggested follow-up action.

Rules:
- Keep notifications clear and concise.
- Never invent dates, amounts or events.
- Do not claim that a notification was delivered.
- Actual delivery requires a connected and authorized service.
- Never include passwords, OTPs or secret API keys.
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
              text: "You are RAZA TECH AI, a professional business notification assistant for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Notification generation failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty notification."
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
