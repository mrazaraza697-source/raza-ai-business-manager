
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

    const safe = (value, max = 2000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      product,
      platform,
      audience,
      objective,
      offer,
      tone,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const productName = safe(product, 300);
    const selectedPlatform = safe(platform, 100);
    const targetAudience = safe(audience, 300);
    const adObjective = safe(objective, 300);
    const offerDetails = safe(offer, 500);
    const selectedTone = safe(tone, 100);
    const extraDetails = safe(details, 2000);

    if (!businessName && !productName && !extraDetails) {
      return res.status(400).json({
        error: "Please provide business or product details."
      });
    }

    const prompt = `
Create a professional, persuasive advertisement.

Business: ${businessName || "Not specified"}
Product/service: ${productName || "Not specified"}
Platform: ${selectedPlatform || "Suitable advertising platform"}
Target audience: ${targetAudience || "General relevant audience"}
Campaign objective: ${adObjective || "Increase awareness and sales"}
Offer: ${offerDetails || "No offer specified"}
Tone: ${selectedTone || "Professional"}
Extra information: ${extraDetails || "None"}

Return:
1. Attention-grabbing advertisement headline.
2. Main advertisement copy.
3. Short version for social media.
4. Strong call to action.
5. Relevant hashtags.
6. Suggested visual concept for the advertisement.

Rules:
- Make the advertisement attractive and professional.
- Match the selected platform and audience.
- Never invent prices, discounts, guarantees or product claims.
- Clearly mark any suggestion that requires confirmation.
- Do not claim that the advertisement has been published.
`;

    const systemInstruction = {
      parts: [{
        text: "You are RAZA TECH AI, a professional advertising strategist and creative marketing expert for RAZA TECHNOLOGIES AI."
      }]
    };

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash"
    ];

    let lastError = "Advertisement generation failed.";
    let lastStatus = 502;

    for (const model of models) {
      // Primary model ko ek extra retry milega.
      const attempts = model === models[0] ? 2 : 1;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                systemInstruction,
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
            lastStatus = response.status;
            lastError =
              data.error?.message ||
              "Advertisement generation failed.";

            const temporaryError = [
              429, 500, 502, 503, 504
            ].includes(response.status);

            if (temporaryError) {
              if (attempt < attempts) {
                await new Promise(resolve =>
                  setTimeout(resolve, 1000)
                );
              }
              continue;
            }

            return res.status(response.status).json({
              error: lastError
            });
          }

          const result = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

          if (result) {
            return res.status(200).json({
              success: true,
              model,
              text: result
            });
          }

          lastStatus = 502;
          lastError = "AI returned an empty advertisement.";

        } catch (error) {
          lastStatus = 502;
          lastError = error.message || "AI connection failed.";
        }
      }
    }

    return res.status(502).json({
      error:
        "Both AI models are currently unavailable. Please try again later. Details: " +
        lastError,
      originalStatus: lastStatus
    });

  } catch (error) {
    console.error("Advertisement handler error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
