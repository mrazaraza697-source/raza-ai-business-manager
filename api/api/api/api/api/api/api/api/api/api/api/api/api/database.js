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
      task,
      recordType,
      business,
      recordData,
      requirements
    } = req.body || {};

    const requestedTask = safe(task, 200);
    const type = safe(recordType, 100);
    const businessName = safe(business, 150);
    const data = safe(
      typeof recordData === "string"
        ? recordData
        : JSON.stringify(recordData || {}),
      4000
    );
    const extraRequirements = safe(requirements, 2000);

    if (!requestedTask && !type && !data) {
      return res.status(400).json({
        error: "Please provide a database task or record details."
      });
    }

    const prompt = `
Design a practical database operation or data structure.

Business: ${businessName || "RAZA TECHNOLOGIES AI"}
Task: ${requestedTask || "Database planning"}
Record type: ${type || "Business record"}
Record data: ${data || "Not provided"}
Requirements: ${extraRequirements || "None"}

Provide:
1. Recommended database structure.
2. Required fields and suitable data types.
3. Relationships between customers, orders and products.
4. Validation rules.
5. Search and reporting recommendations.
6. Backup and recovery plan.
7. Access control and data protection recommendations.
8. A practical implementation checklist.

Important:
- This endpoint is for database planning, not actual data storage.
- Never claim that records were saved, updated or deleted.
- Do not invent missing customer or business information.
- Recommend a secure database service for actual storage.
- Protect personal and business data.
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
              text: "You are RAZA TECH AI, a database planning assistant for RAZA TECHNOLOGIES AI. Give secure, realistic and practical database guidance."
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

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: result.error?.message || "Database planning failed."
      });
    }

    const answer = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error: "AI returned an empty response."
      });
    }

    return res.status(200).json({
      success: true,
      text: answer
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error. Please try again."
    });
  }
}
