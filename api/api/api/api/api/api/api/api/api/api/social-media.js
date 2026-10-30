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
      platforms,
      objective,
      audience,
      frequency,
      brandVoice,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const selectedPlatforms = safe(platforms, 300);
    const campaignObjective = safe(objective, 300);
    const targetAudience = safe(audience, 300);
    const postingFrequency = safe(frequency, 150);
    const voice = safe(brandVoice, 200);
    const extraDetails = safe(details, 2000);

    if (!businessName && !extraDetails) {
      return res.status(400).json({
        error: "Please provide business or campaign details."
      });
    }

    const prompt = `
Create a practical social media management plan.

Business: ${businessName || "Not specified"}
Platforms: ${selectedPlatforms || "Suggest suitable platforms"}
Objective: ${campaignObjective || "Grow brand awareness and engagement"}
Target audience: ${targetAudience || "Relevant customers"}
Posting frequency: ${postingFrequency || "Suggest a suitable schedule"}
Brand voice: ${voice || "Professional and friendly"}
Extra details: ${extraDetails || "None"}

Return:
1. Social media strategy.
2. Recommended content themes.
3. A 7-day posting calendar.
4. Platform-specific post ideas.
5. Captions and calls to action.
6. Relevant hashtags.
7. Engagement and customer response suggestions.
8. Performance metrics to monitor.

Rules:
- Adapt content to each platform.
- Do not invent product claims, prices or offers.
- Do not claim posts have been published or scheduled.
- Clearly identify actions that require platform account access.
- Recommend official platform APIs for publishing and analytics.
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
              text: "You are RAZA TECH AI, a professional social media strategist for RAZA TECHNOLOGIES AI. Create practical, platform-aware strategies."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 3500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Social media plan generation failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty social media plan."
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
