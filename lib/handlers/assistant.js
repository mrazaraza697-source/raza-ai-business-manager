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

    const { prompt, message, task } = req.body || {};
    const userPrompt = String(prompt || message || "").trim();

    if (!userPrompt) {
      return res.status(400).json({ error: "Please enter a prompt." });
    }

    if (userPrompt.length > 12000) {
      return res.status(400).json({ error: "Prompt is too long." });
    }

    const systemInstruction = `
You are RAZA TECH AI, the professional AI business assistant
for RAZA TECHNOLOGIES AI.

Tagline: BUILD SMART. THINK BIG.

Help users with business planning, marketing, social media content,
advertisements, video scripts, emails, customer support and business tasks.

Be practical, accurate and professional.
Do not claim that you have published posts, sent messages,
connected accounts or performed actions unless an authorized
integration confirms that action.

Respond in the language used by the user.
Task: ${String(task || "general business assistance").slice(0, 100)}
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
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
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
