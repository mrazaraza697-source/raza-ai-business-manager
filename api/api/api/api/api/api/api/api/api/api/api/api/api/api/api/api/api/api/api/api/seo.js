
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
      website,
      product,
      pageType,
      targetAudience,
      location,
      primaryKeyword,
      existingContent,
      goals,
      details
    } = req.body || {};

    if (!business && !website && !product && !existingContent && !primaryKeyword) {
      return res.status(400).json({
        success: false,
        error: "Please provide website, product, business, or content information."
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
You are the SEO assistant for RAZA TECHNOLOGIES AI.

Create practical search engine optimization recommendations.

Business: ${business || "Not specified"}
Website: ${website || "Not provided"}
Product or service: ${product || "Not specified"}
Page type: ${pageType || "Not specified"}
Target audience: ${targetAudience || "Not specified"}
Target location: ${location || "Not specified"}
Primary keyword: ${primaryKeyword || "Suggest relevant keywords"}
Existing content: ${existingContent || "Not provided"}
SEO goals: ${goals || "Improve relevant organic search visibility"}
Additional details: ${details || "None"}

Provide:
1. SEO title suggestions with suitable length.
2. Meta description suggestions.
3. Primary and secondary keyword ideas.
4. Suggested headings and page structure.
5. Product or page content improvements.
6. Image alt-text suggestions where relevant.
7. Internal linking ideas.
8. Technical SEO checks to review.
9. Local SEO suggestions when relevant.
10. A prioritized action plan.

Important:
- Do not claim to have checked live Google rankings or website performance.
- Do not invent search volumes, keyword difficulty, traffic or ranking positions.
- Clearly label keyword ideas as suggestions, not verified search data.
- Avoid keyword stuffing and misleading claims.
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
        error: data.error?.message || "SEO request failed."
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
