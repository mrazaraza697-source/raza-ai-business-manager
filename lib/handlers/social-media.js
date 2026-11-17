
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
    const selectedPlatforms = safe(platforms, 500);
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
Create a complete professional social media management strategy.

BUSINESS INFORMATION
Business: ${businessName || "Not specified"}
Platforms: ${selectedPlatforms || "Recommend suitable platforms"}
Objective: ${campaignObjective || "Brand awareness and engagement"}
Target audience: ${targetAudience || "Relevant customers"}
Posting frequency: ${postingFrequency || "Recommend suitable frequency"}
Brand voice: ${voice || "Professional and friendly"}
Additional context: ${extraDetails || "None"}

OUTPUT FORMAT

1. BUSINESS STRATEGY
- Business positioning
- Marketing objectives
- Platform recommendations

2. PLATFORM STRATEGY
For each selected platform:
- Content format
- Recommended posting approach
- Audience engagement strategy

3. CONTENT PILLARS
Provide 4-5 content categories with explanations.

4. WEEKLY CONTENT CALENDAR
Create a 7-day calendar.
For each day include:
- Day
- Platform
- Content type
- Post topic
- Caption
- Call to action
- Hashtags

5. PLATFORM-SPECIFIC IDEAS
Provide at least 3 unique post ideas per selected platform.

6. ENGAGEMENT STRATEGY
- Comment response ideas
- Customer interaction
- Community building

7. PERFORMANCE TRACKING
Include relevant KPIs such as reach, engagement rate,
clicks, leads and conversions.

8. NEXT ACTIONS
Provide 5 practical actions the business can take.

IMPORTANT RULES
- Customize everything to the supplied business.
- Do not invent prices, discounts or product claims.
- Use the requested brand voice.
- Avoid repeating identical captions across platforms.
- Make the calendar practical and realistic.
- Do not claim anything has been published or scheduled.
- Publishing and live analytics require authorized integrations.
- Clearly label recommendations versus actual results.
`;

    
let response;
let data;

for (let attempt = 1; attempt <= 3; attempt++) {
  response = await fetch(
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
            text: "You are RAZA TECH AI, an expert social media strategist working for RAZA TECHNOLOGIES AI. Create detailed, realistic and actionable business strategies."
          }]
        },
        contents: [{
          role: "user",
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 5000
        }
      })
    }
  );

  data = await response.json();

  // Retry only temporary server overload errors.
  if (response.status !== 503 || attempt === 3) {
    break;
  }

  await new Promise(resolve =>
    setTimeout(resolve, attempt * 2000)
  );
}


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
    console.error("Social Media Handler Error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
