
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
      duration,
      style,
      audience,
      objective,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const topic = safe(product, 500);
    const selectedPlatform = safe(platform, 100);
    const videoDuration = safe(duration, 50) || "30 seconds";
    const videoStyle = safe(style, 150);
    const targetAudience = safe(audience, 300);
    const videoObjective = safe(objective, 300);
    const extraDetails = safe(details, 2000);

    if (!topic && !extraDetails) {
      return res.status(400).json({
        error: "Please enter a video topic."
      });
    }

    const allowedDurations = [
      "15 seconds",
      "30 seconds",
      "45 seconds",
      "60 seconds",
      "90 seconds"
    ];

    const finalDuration = allowedDurations.includes(videoDuration)
      ? videoDuration
      : "30 seconds";

    const prompt = `
Create a professional short-form video script.

Business: ${businessName || "Not specified"}
Video topic: ${topic || "Not specified"}
Platform: ${selectedPlatform || "Instagram Reels / TikTok / YouTube Shorts"}
Target duration: ${finalDuration}
Style: ${videoStyle || "Professional and engaging"}
Target audience: ${targetAudience || "Relevant customers"}
Objective: ${videoObjective || "Increase awareness and engagement"}
Extra details: ${extraDetails || "None"}

OUTPUT FORMAT:

1. VIDEO TITLE
Give an attractive title.

2. VIDEO CONCEPT
Explain the main idea briefly.

3. SCENE-BY-SCENE STORYBOARD
Create practical scenes with timestamps.
Each scene must include:
- Scene number and timestamp
- Visual direction
- Camera movement or shot suggestion
- Voiceover or dialogue
- On-screen text

4. VOICEOVER SCRIPT
Provide the complete narration.

5. MUSIC SUGGESTION
Recommend a suitable background music mood.

6. FINAL CALL TO ACTION
Provide a strong ending.

7. SOCIAL MEDIA CAPTION
Write a ready-to-use caption and relevant hashtags.

RULES:
- Make the first 3 seconds attention-grabbing.
- Match the requested duration accurately.
- Keep scene timestamps within the requested duration.
- Use practical scenes suitable for filming or AI video tools.
- Never invent product claims, prices or guarantees.
- Do not claim that a video has been rendered or published.
- Make the output clear and easy to follow.
`;

    const systemInstruction = {
      parts: [{
        text: "You are RAZA TECH AI, an expert video creative director, storyboard artist and marketing scriptwriter for RAZA TECHNOLOGIES AI."
      }]
    };

    const models = [
      "gemini-3.8-flash",
      "gemini-3.7-flash"
    ];

    let lastError = "Video script generation failed.";

    for (const model of models) {
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
                  maxOutputTokens: 4000
                }
              })
            }
          );

          const data = await response.json();

          if (!response.ok) {
            lastError =
              data.error?.message ||
              "Video script generation failed.";

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

          lastError = "AI returned an empty video script.";

        } catch (error) {
          lastError =
            error.message || "AI connection failed.";
        }
      }
    }

    return res.status(502).json({
      error:
        "AI video script service is temporarily unavailable. Please try again. Details: " +
        lastError
    });

  } catch (error) {
    console.error("Video handler error:", error);

    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
