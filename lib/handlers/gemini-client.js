
const PRIMARY_MODEL = "gemini-3.8-flash";
const BACKUP_MODEL = "gemini-3.5-flash-lite";

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];
const REQUEST_TIMEOUT = 12000;

export async function generateGemini({
  apiKey,
  systemInstruction,
  contents,
  generationConfig = {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const attempts = [PRIMARY_MODEL, BACKUP_MODEL];
  let lastError;

  for (const model of attempts) {
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

        if (!RETRYABLE_STATUS.includes(response.status)) {
          throw error;
        }

        lastError = error;
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

      if (!text) {
        lastError = new Error("Gemini returned an empty response.");
        continue;
      }

      return {
        text,
        model
      };

    } catch (error) {
      lastError = error;

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
    "Both Gemini models are temporarily unavailable. Please try again shortly. " +
    (lastError?.message || "")
  );

  finalError.status = lastError?.status || 503;

  throw finalError;
}
