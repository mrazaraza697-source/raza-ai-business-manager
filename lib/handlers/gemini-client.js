
const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const RETRYABLE_STATUS = [404, 429, 500, 502, 503, 504];
const REQUEST_TIMEOUT = 7000;

export async function generateGemini({
  apiKey,
  systemInstruction,
  contents,
  generationConfig = {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  let lastError;
  const failedModels = [];

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents,
            generationConfig
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(
          data.error?.message ||
          `Gemini request failed (${response.status}).`
        );

        error.status = response.status;
        lastError = error;
        failedModels.push(model);

        if (RETRYABLE_STATUS.includes(response.status)) {
          continue;
        }

        throw error;
      }

      const generatedText = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!generatedText) {
        lastError = new Error("Gemini returned an empty response.");
        failedModels.push(model);
        continue;
      }

      return {
        text: generatedText,
        model
      };

    } catch (error) {
      lastError = error;
      failedModels.push(model);

      const retryable =
        RETRYABLE_STATUS.includes(error.status) ||
        error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        error.name === "TypeError";

      if (!retryable) {
        throw error;
      }
    }
  }

  const finalError = new Error(
    "All Gemini models are temporarily unavailable. " +
    "Models tried: " + failedModels.join(", ") + ". " +
    (lastError?.message || "Please try again shortly.")
  );

  finalError.status = lastError?.status || 503;
  throw finalError;
}
