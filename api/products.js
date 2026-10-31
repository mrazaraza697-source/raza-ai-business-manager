
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
      product,
      category,
      features,
      ingredients,
      costPrice,
      sellingPrice,
      targetAudience,
      platform,
      task,
      details
    } = req.body || {};

    if (!product && !business && !details) {
      return res.status(400).json({
        success: false,
        error: "Please provide product or business information."
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
You are the AI Product Manager for RAZA TECHNOLOGIES AI.

Help create professional product information and catalogue content.

Business: ${business || "Not specified"}
Product: ${product || "Not specified"}
Category: ${category || "Not specified"}
Features: ${features || "Not provided"}
Ingredients or materials: ${ingredients || "Not provided"}
Cost price: ${costPrice ?? "Not provided"}
Selling price: ${sellingPrice ?? "Not provided"}
Target audience: ${targetAudience || "Not specified"}
Platform: ${platform || "Website or social media"}
Requested task: ${task || "Create a complete product listing"}
Additional details: ${details || "None"}

Provide relevant sections:
1. Professional product title.
2. Clear product description.
3. Main features and benefits.
4. Suggested product specifications.
5. Short marketing description.
6. Frequently asked customer questions and answers.
7. Suggested product tags and search keywords.
8. Pricing observations only when sufficient price information is provided.
9. Suggestions for improving the product listing.
10. A suitable call to action.

Important:
- Never invent ingredients, certifications, product results or specifications.
- Do not make unsupported medical or guaranteed performance claims.
- Do not change facts supplied about the product.
- Clearly label suggestions and assumptions.
- Do not claim to have added or updated a real product catalogue.
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
        error: data.error?.message || "Product request failed."
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
