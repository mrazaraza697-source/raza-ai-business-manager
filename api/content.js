export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }

    const { business, product, platform, tone, details, task } = req.body || {};

    const safe = (value, max = 2000) =>
      String(value || "").trim().slice(0, max);

    const businessName = safe(business, 150);
    const productName = safe(product, 300);
    const selectedPlatform = safe(platform, 100);
    const selectedTone = safe(tone, 100);
    const extraDetails = safe(details, 2000);
    const contentTask = safe(task || "social media content", 100);

    if (!businessName && !productName && !extraDetails) {
      return res.status(400).json({
        error: "Please provide business, product or content details."
      });
    }

    const prompt = `
Create professional business marketing content.

Task: ${contentTask}
Business: ${businessName || "Not specified"}
Product or service: ${productName || "Not specified"}
Platform: ${selectedPlatform || "Suitable social platform"}
Tone: ${selectedTone || "Professional"}
Extra details: ${extraDetails || "None"}

Requirements:
- Write engaging, original and useful content.
- Match the selected platform and tone.
- Use a clear headline and suitable call to action.
- Add relevant hashtags when appropriate.
- Do not invent prices, guarantees, contact details or product claims.
- Return the finished content in a clean, copy-ready format.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "You are RAZA TECH AI, an expert business content and marketing assistant for RAZA TECHNOLOGIES AI. Be accurate, creative and professional."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Content generation failed."
      });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!text) {
      return res.status(502).json({ error: "AI returned an empty response." });
    }

    return res.status(200).json({
      success: true,
      text
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
