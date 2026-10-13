import "server-only";

const ALLOWED_FREE_MODELS = new Set(["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"]);

export function readOnDemandAiModel(): string {
  const model = process.env.GEMINI_ON_DEMAND_MODEL?.trim() || "gemini-3.1-flash-lite";
  if (!ALLOWED_FREE_MODELS.has(model)) throw new Error("AI_INVALID_REQUEST");
  return model;
}
