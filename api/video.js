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
      product,
      platform,
      duration,
      style,
      audience,
      objective,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const productName = safe(product, 300);
    const selectedPlatform = safe(platform, 100);
    const videoDuration = safe(duration, 50);
    const videoStyle = safe(style, 150);
    const targetAudience = safe(audience, 300);
    const videoObjective = safe(objective, 300);
    const extraDetails = safe(details, 2000);

    if (!businessName && !productName && !extraDetails) {
      return res.status(400).json({
        error: "Please provide business or product details."
      });
    }

    const prompt = `
Create a professional short-form marketing video script.

Business: ${businessName || "Not specified"}
Product/service: ${productName || "Not specified"}
Platform: ${selectedPlatform || "Instagram Reels / TikTok / YouTube Shorts"}
Duration: ${videoDuration || "30 seconds"}
Style: ${videoStyle || "Professional and engaging"}
Target audience: ${targetAudience || "Relevant customers"}
Objective: ${videoObjective || "Increase awareness and sales"}
Extra details: ${extraDetails || "None"}

Provide:
1. Video concept and title.
2. Scene-by-scene storyboard with timestamps.
3. Visual direction for each scene.
4. Voiceover or dialogue.
5. On-screen text.
6. Background music mood suggestion.
7. Final call to action.
8. Caption and relevant hashtags.

Rules:
- Make the opening 3 seconds attention-grabbing.
- Keep the script suitable for the selected duration.
- Use practical scenes that can be filmed or created with AI video tools.
- Never invent product claims, prices or guarantees.
- Do not claim that a video file has been rendered or published.
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
              text: "You are RAZA TECH AI, an expert video creative director and marketing scriptwriter for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Video script generation failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty video script."
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
