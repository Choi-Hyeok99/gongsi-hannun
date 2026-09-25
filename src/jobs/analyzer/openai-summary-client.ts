import type {
  AiAnalysisCandidate,
  AiDisclosureSummaryProvider,
  GeneratedAiDisclosureSummaryCandidate,
} from "@/domain/ai-disclosure-summary";
import type { AiProviderUsage } from "./gemini-summary-client";
import {
  buildDisclosureSummaryPrompt,
  DISCLOSURE_SUMMARY_JSON_SCHEMA,
  DISCLOSURE_SUMMARY_MAX_OUTPUT_TOKENS,
  DISCLOSURE_SUMMARY_SYSTEM_INSTRUCTION,
  parseDisclosureSummary,
} from "./disclosure-summary-contract";

const DEFAULT_MODEL = "gpt-6-luna";
const REQUEST_TIMEOUT_MS = 45_000;

type OpenAiResponse = Readonly<{
  output?: readonly Readonly<{
    type?: string;
    content?: readonly Readonly<{ type?: string; text?: string }>[];
  }>[];
  usage?: Readonly<{ input_tokens?: number; output_tokens?: number; total_tokens?: number }>;
}>;

type Options = Readonly<{
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  onUsage?: (usage: AiProviderUsage) => void;
}>;

export class OpenAiDisclosureSummaryClient implements AiDisclosureSummaryProvider {
  readonly providerName = "openai";
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly onUsage?: (usage: AiProviderUsage) => void;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.modelName = options.model ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    this.onUsage = options.onUsage;
  }

  async summarize(candidate: AiAnalysisCandidate): Promise<GeneratedAiDisclosureSummaryCandidate> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(buildRequest(candidate, this.modelName)),
      });
      if (!response.ok) throw new Error(await classifyHttpError(response));
      const body = await response.json() as OpenAiResponse;
      if (body.usage) this.onUsage?.({
        inputTokens: body.usage.input_tokens ?? 0,
        outputTokens: body.usage.output_tokens ?? 0,
        totalTokens: body.usage.total_tokens ?? 0,
      });
      const text = body.output
        ?.filter((item) => item.type === "message")
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("AI_INVALID_RESPONSE");
      return parseDisclosureSummary(JSON.parse(text) as unknown);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("AI_INVALID_RESPONSE");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildRequest(candidate: AiAnalysisCandidate, model: string) {
  return {
    model,
    store: false,
    reasoning: { effort: "none" },
    max_output_tokens: DISCLOSURE_SUMMARY_MAX_OUTPUT_TOKENS,
    input: [
      { role: "system", content: [{ type: "input_text", text: DISCLOSURE_SUMMARY_SYSTEM_INSTRUCTION }] },
      { role: "user", content: [{ type: "input_text", text: buildDisclosureSummaryPrompt(candidate) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "disclosure_summary",
        strict: true,
        schema: DISCLOSURE_SUMMARY_JSON_SCHEMA,
      },
    },
  };
}

async function classifyHttpError(response: Response): Promise<string> {
  const status = response.status;
  if (status === 400 || status === 422) return "AI_INVALID_REQUEST";
  if (status === 401 || status === 403) return "AI_AUTH_ERROR";
  if (status === 404) return "AI_MODEL_NOT_FOUND";
  if (status === 408) return "AI_TIMEOUT";
  if (status === 429) {
    const code = await readOpenAiErrorCode(response);
    return code === "insufficient_quota" ? "AI_QUOTA_EXHAUSTED" : "AI_RATE_LIMITED";
  }
  if (status >= 500) return "AI_PROVIDER_UNAVAILABLE";
  return "AI_UPSTREAM_ERROR";
}

async function readOpenAiErrorCode(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as Readonly<{ error?: Readonly<{ code?: unknown }> }>;
    return typeof body.error?.code === "string" ? body.error.code : null;
  } catch {
    return null;
  }
}
