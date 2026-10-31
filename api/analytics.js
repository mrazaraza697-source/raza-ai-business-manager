
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
      period,
      sales,
      expenses,
      customers,
      leads,
      posts,
      campaigns,
      engagement,
      goals,
      details
    } = req.body || {};

    if (
      sales === undefined &&
      expenses === undefined &&
      customers === undefined &&
      leads === undefined &&
      !posts &&
      !campaigns &&
      !engagement &&
      !details
    ) {
      return res.status(400).json({
        success: false,
        error: "Please provide business data for analysis."
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
You are the business analytics AI for RAZA TECHNOLOGIES AI.

Analyze the business information below and create a clear, useful report.

Business: ${business || "Not specified"}
Reporting period: ${period || "Not specified"}
Sales: ${sales ?? "Not provided"}
Expenses: ${expenses ?? "Not provided"}
Customers: ${customers ?? "Not provided"}
Leads: ${leads ?? "Not provided"}
Posts: ${posts || "Not provided"}
Campaigns: ${campaigns || "Not provided"}
Engagement: ${engagement || "Not provided"}
Business goals: ${goals || "Not provided"}
Additional information: ${details || "None"}

Report requirements:
1. Summarize the information provided.
2. Calculate profit only when both sales and expenses are provided as comparable numeric values.
3. Identify trends only when enough data is available.
4. Highlight strengths and possible problems.
5. Recommend practical improvements.
6. Suggest useful next steps for sales, marketing and customer growth.
7. Never invent missing figures or claim access to live business accounts.
8. Clearly label estimates and assumptions.
9. Use professional headings and simple language.
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
        error: data.error?.message || "Analytics request failed."
      });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n");

    if (!text) {
      return res.status(502).json({
        success: false,
        error: "AI returned an empty report."
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
