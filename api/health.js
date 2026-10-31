
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return res.status(200).json({
    success: true,
    application: "RAZA AI BUSINESS MANAGER",
    company: "RAZA TECHNOLOGIES AI",
    status: "Backend is running",
    timestamp: new Date().toISOString(),
    services: {
      api: "Available",
      geminiApiKey: geminiConfigured ? "Configured" : "Missing"
    }
  });
}
