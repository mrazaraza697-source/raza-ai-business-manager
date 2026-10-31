
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      business,
      industry,
      products,
      targetAudience,
      location,
      budget,
      goals,
      challenges,
      competitors,
      timeframe,
      details
    } = req.body || {};

    if (!business && !products && !goals && !details) {
      return res.status(400).json({
        success: false,
        error: "Please provide business information or goals."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const prompt = `
You are the senior business strategy advisor for RAZA TECHNOLOGIES AI.

Create a realistic and actionable business growth strategy.

Business: ${business || "Not specified"}
Industry: ${industry || "Not specified"}
Products or services: ${products || "Not specified"}
Target audience: ${targetAudience || "Not specified"}
Business location: ${location || "Not specified"}
Available budget: ${budget || "Not specified"}
Business goals: ${goals || "Not specified"}
Current challenges: ${challenges || "Not specified"}
Known competitors: ${competitors || "Not specified"}
Planning timeframe: ${timeframe || "Recommend a practical timeframe"}
Additional details: ${details || "None"}

Include:
1. Business situation summary.
2. Target customer and positioning recommendations.
3. Marketing and sales strategy.
4. Product and pricing improvement ideas.
5. Budget-conscious action plan.
6. Social media and advertising recommendations.
7. Customer acquisition and retention plan.
8. Measurable goals and key performance indicators.
9. A practical weekly action plan.
10. Risks, assumptions and possible limitations.

Important:
- Never invent market research, competitor facts or financial figures.
- Clearly label estimates and assumptions.
- Prioritize affordable and practical actions.
- Do not claim to have executed any business activity.
- Use clear, professional language.
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
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || "Strategy request failed."
      });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n");

    if (!text) {
      return res.status(502).json({
        success: false,
        error: "AI returned an empty response."
      });
    }

    return res.status(200).json({
      success: true,
      text
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error."
    });
  }
}
