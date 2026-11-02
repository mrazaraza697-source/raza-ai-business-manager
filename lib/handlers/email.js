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

    const safe = (value, max = 2000) =>
      String(value || "").trim().slice(0, max);

    const {
      business,
      recipient,
      purpose,
      tone,
      keyPoints,
      language,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const recipientType = safe(recipient, 200);
    const emailPurpose = safe(purpose, 500);
    const emailTone = safe(tone, 100);
    const importantPoints = safe(keyPoints, 2000);
    const emailLanguage = safe(language, 100);
    const extraDetails = safe(details, 2000);

    if (!emailPurpose && !importantPoints && !extraDetails) {
      return res.status(400).json({
        error: "Please provide the email purpose or details."
      });
    }

    const prompt = `
Write a professional business email.

Business: ${businessName || "Not specified"}
Recipient: ${recipientType || "Not specified"}
Purpose: ${emailPurpose || "Not specified"}
Tone: ${emailTone || "Professional"}
Important points: ${importantPoints || "None"}
Language: ${emailLanguage || "Match the user's language"}
Extra details: ${extraDetails || "None"}

Return:
1. A suitable subject line.
2. A complete email with greeting and closing.
3. A concise, professional message.
4. A suitable call to action where appropriate.

Rules:
- Do not invent names, addresses, dates, prices or commitments.
- Use placeholders where required information is missing.
- Do not claim the email has been sent.
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
              text: "You are RAZA TECH AI, a professional business communication and email writing assistant for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Email generation failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty email."
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
