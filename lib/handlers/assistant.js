
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured on Vercel."
      });
    }

    const { prompt, message, task, businessInfo } = req.body || {};

    const userPrompt = String(prompt || message || "").trim();

    if (!userPrompt) {
      return res.status(400).json({
        error: "Please enter a prompt."
      });
    }

    if (userPrompt.length > 12000) {
      return res.status(400).json({
        error: "Prompt is too long."
      });
    }

    const systemInstruction = `
You are RAZA TECH AI, the intelligent business assistant
inside RAZA AI BUSINESS MANAGER by RAZA TECHNOLOGIES AI.

TAGLINE: BUILD SMART. THINK BIG.

YOUR ROLE:
Act as a professional business strategist, marketing expert,
advertising copywriter, social media manager and business advisor.

YOUR PERSONALITY:
- Creative, confident, helpful and professional.
- Think like an experienced marketing professional.
- Give practical ideas, not generic advice.
- Help users save time and grow their businesses.
- Understand Roman Urdu, Urdu and English.
- Reply in the language used by the user.

MARKETING AND ADVERTISING:
- Write attractive, persuasive and high-quality advertisements.
- Create powerful hooks, captions, headlines and CTAs.
- Suggest hashtags, reels, video scripts and campaigns.
- Explain real product benefits in appealing language.
- Focus on customer needs and reasons to buy.
- Adapt content for Instagram, Facebook, TikTok and WhatsApp.
- Be creative and persuasive without making false promises.

TRUTH AND PRODUCT ACCURACY:
- Never invent product ingredients, prices, discounts,
  delivery offers, customer reviews or guarantees.
- Do not claim specific results or timelines without evidence.
- Present supplied and verified product benefits confidently.
- If information is missing, ask for it or use clearly marked
  placeholders.
- For cosmetic products, distinguish appearance and care
  benefits from medical or guaranteed treatment claims.

BUSINESS MANAGEMENT:
Help with business planning, product descriptions,
customer support, sales strategies, email writing,
advertisement planning, reports and daily business tasks.

IMPORTANT:
Never claim that you published a post, sent a message,
connected an account or completed an action unless the
authorized integration confirms it.

BUSINESS INFORMATION:
${String(businessInfo || "No additional business information provided.").slice(0, 3000)}

CURRENT TASK:
${String(task || "General business assistance").slice(0, 100)}
`;

    const model = "gemini-3.8-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [{
            role: "user",
            parts: [{ text: userPrompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const googleError = data.error || {};

      const errorMessage =
        googleError.message || "Unknown Gemini API error.";

      const errorCode =
        googleError.status || "UNKNOWN";

      console.error("RAZA TECH AI Gemini Error:", {
        httpStatus: response.status,
        errorCode,
        message: errorMessage
      });

      let userMessage = errorMessage;

      if (response.status === 429) {
        userMessage =
          "Gemini API quota or rate limit reached. Check your Google AI Studio usage and retry after the quota resets.";
      } else if (response.status === 503) {
        userMessage =
          "Gemini service is temporarily unavailable. Please try again shortly.";
      } else if (response.status === 400) {
        userMessage =
          "Gemini rejected the request. Check the model name and request configuration.";
      } else if (response.status === 401 || response.status === 403) {
        userMessage =
          "Gemini API authentication or permission error. Check your API key and Google project settings.";
      }

      return res.status(response.status).json({
        success: false,
        error: userMessage,
        provider: "Google Gemini",
        providerStatus: response.status,
        providerCode: errorCode,
        providerMessage: errorMessage,
        retryable: response.status === 429 || response.status === 503
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      console.error("Gemini returned no text:", {
        finishReason: data.candidates?.[0]?.finishReason,
        promptFeedback: data.promptFeedback
      });

      return res.status(502).json({
        success: false,
        error: "Gemini returned an empty response.",
        provider: "Google Gemini",
        finishReason: data.candidates?.[0]?.finishReason || null
      });
    }

    return res.status(200).json({
      success: true,
      text: answer,
      task: task || "general",
      provider: "Google Gemini"
    });

  } catch (error) {
    console.error("RAZA TECH AI Server Error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Server error. Please try again later."
    });
  }
}
