import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { createSupabaseAiAnalysisRepository } from "@/data/supabase-ai-analysis-repository";
import { compareCandidate, type CandidateComparisonResult, type ComparisonProvider } from "@/server/ai-provider-comparison";
import { GeminiDisclosureSummaryClient, type AiProviderUsage } from "./gemini-summary-client";
import { OpenAiDisclosureSummaryClient } from "./openai-summary-client";

const GEMINI_INPUT_USD_PER_MILLION = 0.30;
const GEMINI_OUTPUT_USD_PER_MILLION = 2.50;
const OPENAI_INPUT_USD_PER_MILLION = 0.10;
const OPENAI_OUTPUT_USD_PER_MILLION = 0.50;

const environmentSchema = z.object({
  GEMINI_API_KEY: z.string().min(20),
  OPENAI_API_KEY: z.string().min(20),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  OPENAI_MODEL: z.literal("gpt-6-luna").default("gpt-6-luna"),
  AI_COMPARISON_LIMIT: z.coerce.number().int().min(1).max(30).default(30),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

async function main() {
  const environment = environmentSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_COMPARISON_LIMIT: process.env.AI_COMPARISON_LIMIT,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  const repository = createSupabaseAiAnalysisRepository({
    supabaseUrl: environment.SUPABASE_URL,
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY,
  });
  const candidates = await repository.findCandidates(environment.AI_COMPARISON_LIMIT, `provider-comparison-${Date.now()}`);
  const results: CandidateComparisonResult[] = [];

  for (const [index, candidate] of candidates.entries()) {
    process.stdout.write(`Comparing ${index + 1}/${candidates.length}: ${candidate.receiptNumber}\n`);
    let geminiUsage: AiProviderUsage | null = null;
    let openAiUsage: AiProviderUsage | null = null;
    const providers: readonly ComparisonProvider[] = [
      {
        client: new GeminiDisclosureSummaryClient({
          apiKey: environment.GEMINI_API_KEY,
          model: environment.GEMINI_MODEL,
          onUsage: (usage) => { geminiUsage = usage; },
        }),
        getUsage: () => geminiUsage,
        inputUsdPerMillion: GEMINI_INPUT_USD_PER_MILLION,
        outputUsdPerMillion: GEMINI_OUTPUT_USD_PER_MILLION,
      },
      {
        client: new OpenAiDisclosureSummaryClient({
          apiKey: environment.OPENAI_API_KEY,
          model: environment.OPENAI_MODEL,
          onUsage: (usage) => { openAiUsage = usage; },
        }),
        getUsage: () => openAiUsage,
        inputUsdPerMillion: OPENAI_INPUT_USD_PER_MILLION,
        outputUsdPerMillion: OPENAI_OUTPUT_USD_PER_MILLION,
      },
    ];
    results.push(await compareCandidate(candidate, providers));
  }

  const createdAt = new Date().toISOString();
  const output = { createdAt, requestedCount: environment.AI_COMPARISON_LIMIT, comparedCount: results.length, results };
  const stamp = createdAt.replace(/[:.]/g, "-");
  await mkdir("outputs", { recursive: true });
  const jsonPath = `outputs/ai-provider-comparison-${stamp}.json`;
  const markdownPath = `outputs/ai-provider-comparison-${stamp}.md`;
  const markdown = renderMarkdown(output);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, markdown, "utf8"),
  ]);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  process.stdout.write(`Comparison complete: ${results.length} disclosures\n${jsonPath}\n${markdownPath}\n`);
}

function renderMarkdown(output: Readonly<{ createdAt: string; requestedCount: number; comparedCount: number; results: readonly CandidateComparisonResult[] }>): string {
  const providerNames = [...new Set(output.results.flatMap((result) => result.providers.map((provider) => provider.model)))];
  const lines = [
    "# AI provider comparison",
    "",
    `- Created: ${output.createdAt}`,
    `- Requested/compared: ${output.requestedCount}/${output.comparedCount}`,
    "- Read-only evaluation: production AI summaries were not inserted or updated.",
    "- Price assumptions: Gemini 3.5 Flash-Lite $0.30 input / $2.50 output; GPT-6 Luna $0.10 input / $0.50 output per 1M tokens.",
    "",
    "## Aggregate",
    "",
    "| Model | Success | Avg latency | Input tokens | Output tokens | Verified facts | Estimated cost |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const model of providerNames) {
    const results = output.results.flatMap((result) => result.providers).filter((provider) => provider.model === model);
    const successes = results.filter((result) => result.status === "SUCCEEDED");
    const inputTokens = results.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0);
    const outputTokens = results.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0);
    const verifiedFacts = results.reduce((sum, result) => sum + result.verifiedFactCount, 0);
    const cost = results.reduce((sum, result) => sum + (result.estimatedCostUsd ?? 0), 0);
    const latency = results.length > 0 ? Math.round(results.reduce((sum, result) => sum + result.latencyMs, 0) / results.length) : 0;
    lines.push(`| ${escapeTable(model)} | ${successes.length}/${results.length} | ${latency} ms | ${inputTokens} | ${outputTokens} | ${verifiedFacts} | $${cost.toFixed(6)} |`);
  }
  lines.push("", "## Per disclosure", "");
  for (const result of output.results) {
    lines.push(`### ${escapeHeading(result.companyName)} — ${escapeHeading(result.reportName)}`, "", `Receipt: ${result.receiptNumber} · Date: ${result.disclosedOn}`, "");
    for (const provider of result.providers) {
      lines.push(`- **${escapeHeading(provider.model)}**: ${provider.status}, ${provider.latencyMs} ms, facts ${provider.verifiedFactCount}, cost ${provider.estimatedCostUsd === null ? "n/a" : `$${provider.estimatedCostUsd.toFixed(6)}`}`);
      if (provider.summary) lines.push(`  - Summary: ${singleLine(provider.summary.plainSummary)}`, `  - Why it matters: ${singleLine(provider.summary.whyItMatters)}`);
      if (provider.errorCode) lines.push(`  - Error: ${provider.errorCode}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function escapeTable(value: string): string {
  return singleLine(value).replaceAll("|", "\\|");
}

function escapeHeading(value: string): string {
  return singleLine(value).replace(/^#+/, "");
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

main().catch((error: unknown) => {
  const message = error instanceof Error && /^AI_[A-Z_]+$/.test(error.message) ? error.message : "AI_COMPARISON_FAILED";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
