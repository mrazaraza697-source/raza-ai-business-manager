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

    const safe = (value, max = 5000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      period,
      sales,
      expenses,
      orders,
      customers,
      marketing,
      goals,
      details
    } = req.body || {};

    const reportData = {
      business: safe(business, 150),
      period: safe(period, 100),
      sales: safe(sales),
      expenses: safe(expenses),
      orders: safe(orders),
      customers: safe(customers),
      marketing: safe(marketing),
      goals: safe(goals, 1000),
      details: safe(details, 2000)
    };

    if (
      !reportData.sales &&
      !reportData.orders &&
      !reportData.customers &&
      !reportData.marketing &&
      !reportData.details
    ) {
      return res.status(400).json({
        error: "Please provide some business report data."
      });
    }

    const prompt = `
Analyze the following business information.

${JSON.stringify(reportData, null, 2)}

Create a professional business performance report with:

1. Executive summary.
2. Sales and revenue analysis.
3. Expenses and profitability analysis, if data is available.
4. Orders and customer performance.
5. Marketing performance.
6. Important trends and observations.
7. Problems or risks that need attention.
8. Five practical recommendations.
9. Suggested next steps and priorities.

Important rules:
- Use only the information provided.
- Do not invent missing figures or statistics.
- Show calculations only when the required data is available.
- Clearly label estimates and assumptions.
- If information is missing, explain what is needed.
- Do not claim access to bank accounts or external business systems.
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
              text: "You are RAZA TECH AI, a careful business analyst for RAZA TECHNOLOGIES AI. Prepare clear, accurate and practical business reports."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 3500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Report generation failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty report."
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
