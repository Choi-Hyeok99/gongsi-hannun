import "server-only";
import type { AiAnalysisRepository } from "@/domain/ai-disclosure-summary";
import { readServerEnvironment } from "@/server/env";
import { createSupabaseAiAnalysisRepository } from "./supabase-ai-analysis-repository";

export function createAiAnalysisRepository(): AiAnalysisRepository {
  const environment = readServerEnvironment();
  return createSupabaseAiAnalysisRepository({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  });
}
