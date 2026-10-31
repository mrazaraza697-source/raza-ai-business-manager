
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      business,
      platforms,
      campaign,
      startDate,
      endDate,
      frequency,
      preferredTimes,
      goals,
      details
    } = req.body || {};

    if (!campaign && !goals && !details) {
      return res.status(400).json({
        success: false,
        error: "Please provide a campaign, goal, or details."
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
You are the AI scheduling planner for RAZA TECHNOLOGIES AI.

Create a practical business content and activity schedule.

Business: ${business || "Not specified"}
Platforms: ${platforms || "Recommend suitable platforms"}
Campaign: ${campaign || "Not specified"}
Start date: ${startDate || "Not specified"}
End date: ${endDate || "Not specified"}
Frequency: ${frequency || "Recommend a suitable frequency"}
Preferred times: ${preferredTimes || "Recommend suitable times"}
Goals: ${goals || "Not specified"}
Additional details: ${details || "None"}

Requirements:
1. Create a clear calendar with dates and suggested times where possible.
2. Recommend content types and platforms.
3. Include campaign tasks and useful reminders.
4. Explain the purpose of each scheduled activity.
5. Consider the business audience and goals.
6. State any date or timezone assumptions.
7. Do not claim that anything has actually been published, sent, or scheduled on a platform.
8. Present the result in clear, professional language.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error?.message || "AI scheduling request failed."
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

    return res.status(200).json({ success: true, text });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error."
    });
  }
}
