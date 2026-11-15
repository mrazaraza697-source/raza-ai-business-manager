
const PRIMARY_MODEL = "gemini-3.8-flash";
const BACKUP_MODEL = "gemini-3.5-flash-lite";

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function generateGemini({
  apiKey,
  systemInstruction,
  contents,
  generationConfig = {}
}) {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const attempts = [
    { model: PRIMARY_MODEL, delay: 0 },
    { model: PRIMARY_MODEL, delay: 1200 },
    { model: BACKUP_MODEL, delay: 0 }
  ];

  let lastError;

  for (const attempt of attempts) {
    if (attempt.delay) {
      await wait(attempt.delay);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(25000),
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
          data.error?.message || `Gemini request failed (${response.status}).`
        );

        error.status = response.status;

        if (!RETRYABLE_STATUS.includes(response.status)) {
          throw error;
        }

        lastError = error;
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      return {
        text,
        model: attempt.model
      };

    } catch (error) {
      lastError = error;

      const retryable =
        !error.status ||
        RETRYABLE_STATUS.includes(error.status) ||
        error.name === "TimeoutError" ||
        error.name === "AbortError";

      if (!retryable) {
        throw error;
      }
    }
  }

  throw new Error(
    "Both Gemini models are temporarily unavailable. Please try again shortly. " +
    (lastError?.message || "")
  );
}
