
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const {
      business,
      product,
      platform,
      tone,
      language,
      details,
      task
    } = req.body || {};

    const safe = (value, max = 2000) =>
      String(value || "").trim().slice(0, max);

    const businessName = safe(business, 150);
    const productName = safe(product, 300);
    const selectedPlatform = safe(platform, 100);
    const selectedTone = safe(tone || "Professional", 100);
    const selectedLanguage = safe(language || "English", 50);
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
Tone: ${selectedTone}
Language: ${selectedLanguage}
Extra details: ${extraDetails || "None"}

Requirements:
- Write in the selected language.
- Create engaging, original and useful content.
- Match the selected platform and tone.
- Use a clear headline and suitable call to action.
- Add relevant hashtags when appropriate.
- Do not invent prices, guarantees, contact details or product claims.
- Return finished content in a clean, copy-ready format.
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
      const providerMessage =
        data.error?.message || "Content generation failed.";

      console.error("Gemini Content API Error:", {
        status: response.status,
        message: providerMessage
      });

      if (response.status === 429) {
        return res.status(429).json({
          error: "Gemini usage limit reached. Please try again later.",
          providerStatus: 429
        });
      }

      if (response.status === 503) {
        return res.status(503).json({
          error: "Gemini is temporarily experiencing high demand. Please try again shortly.",
          providerStatus: 503
        });
      }

      return res.status(response.status).json({
        error: providerMessage,
        providerStatus: response.status
      });
    }

    const generatedText = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!generatedText) {
      return res.status(502).json({
        error: "AI returned an empty response."
      });
    }

    return res.status(200).json({
      success: true,
      text: generatedText,
      provider: "Gemini"
    });

  } catch (error) {
    console.error("Content Handler Error:", error);

    return res.status(500).json({
      error: "Server error while generating content."
    });
  }
}
