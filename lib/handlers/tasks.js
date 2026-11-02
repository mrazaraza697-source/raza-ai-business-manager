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
      task,
      goals,
      deadline,
      priority,
      team,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const taskName = safe(task, 300);
    const businessGoals = safe(goals, 1500);
    const taskDeadline = safe(deadline, 100);
    const taskPriority = safe(priority, 100);
    const teamDetails = safe(team, 500);
    const extraDetails = safe(details, 2000);

    if (!taskName && !businessGoals && !extraDetails) {
      return res.status(400).json({
        error: "Please provide a task or business goal."
      });
    }

    const prompt = `
Create a practical business task plan.

Business: ${businessName || "RAZA TECHNOLOGIES AI"}
Task: ${taskName || "Not specified"}
Goals: ${businessGoals || "Not specified"}
Deadline: ${taskDeadline || "Not specified"}
Priority: ${taskPriority || "Suggest an appropriate priority"}
Team: ${teamDetails || "Not specified"}
Extra details: ${extraDetails || "None"}

Return:
1. Task summary.
2. Priority level with reason.
3. Step-by-step action plan.
4. Suggested timeline.
5. Required resources.
6. Dependencies and possible risks.
7. Completion checklist.
8. Suggested next action.

Rules:
- Do not invent deadlines or team members.
- Clearly mark assumptions.
- Do not claim that tasks were created or completed in an external system.
- Keep the plan realistic and easy to follow.
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
              text: "You are RAZA TECH AI, an expert business task planner for RAZA TECHNOLOGIES AI."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Task planning failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty task plan."
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
