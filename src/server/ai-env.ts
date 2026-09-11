import "server-only";
import { z } from "zod";

const schema = z.object({
  GEMINI_API_KEY: z.string().min(20),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash-lite"),
  AI_ANALYSIS_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
});

export function readAiAnalysisEnvironment() {
  return schema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    AI_ANALYSIS_LIMIT: process.env.AI_ANALYSIS_LIMIT,
  });
}
