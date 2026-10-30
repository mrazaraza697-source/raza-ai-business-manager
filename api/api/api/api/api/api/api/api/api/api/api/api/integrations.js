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

    const safe = (value, max = 3000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      platform,
      goal,
      currentSetup,
      requirements,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const selectedPlatform = safe(platform, 150);
    const integrationGoal = safe(goal, 1000);
    const setup = safe(currentSetup, 2000);
    const requiredPermissions = safe(requirements, 2000);
    const extraDetails = safe(details, 2000);

    if (!selectedPlatform && !integrationGoal && !extraDetails) {
      return res.status(400).json({
        error: "Please provide a platform or integration goal."
      });
    }

    const prompt = `
Create a secure integration plan for a business management system.

Business: ${businessName || "Not specified"}
Platform: ${selectedPlatform || "Not specified"}
Goal: ${integrationGoal || "Not specified"}
Current setup: ${setup || "Not provided"}
Required permissions: ${requiredPermissions || "Not specified"}
Extra details: ${extraDetails || "None"}

Provide:
1. Integration overview.
2. Official API or approved connection required.
3. Setup steps.
4. Permissions and access needed.
5. Secure storage requirements for tokens and keys.
6. Data flow between the platform and business manager.
7. Error handling and connection monitoring.
8. Limitations, review requirements or possible costs.
9. Owner approval points.

Security rules:
- Recommend official APIs and OAuth where supported.
- Never ask the user to share passwords, OTPs or secret API keys in chat.
- Store credentials only in secure server-side environment variables.
- Never expose access tokens in frontend code or public GitHub files.
- Do not claim an account is connected unless an actual integration confirms it.
- Do not suggest bypassing platform restrictions or app reviews.
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
              text: "You are RAZA TECH AI, a security-conscious integration architect for RAZA TECHNOLOGIES AI. Give realistic and safe technical guidance."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Integration planning failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty integration plan."
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
