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
      workflow,
      trigger,
      action,
      schedule,
      rules,
      details
    } = req.body || {};

    const businessName = safe(business, 150);
    const workflowName = safe(workflow, 200);
    const workflowTrigger = safe(trigger, 500);
    const workflowAction = safe(action, 1000);
    const workflowSchedule = safe(schedule, 200);
    const workflowRules = safe(rules, 2000);
    const extraDetails = safe(details, 2000);

    if (!workflowTrigger && !workflowAction && !extraDetails) {
      return res.status(400).json({
        error: "Please provide automation details."
      });
    }

    const prompt = `
Design a practical business automation workflow.

Business: ${businessName || "Not specified"}
Workflow name: ${workflowName || "Business automation"}
Trigger: ${workflowTrigger || "Not specified"}
Desired action: ${workflowAction || "Not specified"}
Schedule: ${workflowSchedule || "Not specified"}
Rules: ${workflowRules || "Not provided"}
Extra details: ${extraDetails || "None"}

Return:
1. Workflow name and objective.
2. Trigger and required conditions.
3. Step-by-step automation process.
4. Required platform integrations and permissions.
5. Data needed for each step.
6. Error handling and retry plan.
7. Actions that need owner approval.
8. A simple implementation checklist.

Important:
- Clearly distinguish a proposed workflow from a working automation.
- Never claim that an action has been executed.
- Do not bypass platform permissions or policies.
- Require owner approval for publishing, sending bulk messages,
  spending money, deleting data or other sensitive actions.
- Prefer official APIs and secure integrations.
- Mention when a service or API may require approval or payment.
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
              text: "You are RAZA TECH AI, an expert business automation architect for RAZA TECHNOLOGIES AI. Design secure, realistic and practical workflows."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Automation design failed."
      });
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "AI returned an empty automation plan."
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
