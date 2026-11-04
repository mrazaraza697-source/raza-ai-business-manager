
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
            parts: [{ text: systemInstruction }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        return res.status(response.status).json({
          error: "Gemini is busy or its usage limit has been reached. Please try again shortly."
        });
      }

      return res.status(response.status).json({
        error: data.error?.message || "Gemini AI request failed."
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "AI returned an empty response. Please try again."
      });
    }

    return res.status(200).json({
      success: true,
      text: answer,
      task: task || "general"
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again later."
    });
  }
}
