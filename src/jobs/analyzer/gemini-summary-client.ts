import type {
  AiAnalysisCandidate,
  AiDisclosureSummaryProvider,
  GeneratedAiDisclosureSummaryCandidate,
} from "@/domain/ai-disclosure-summary";
import {
  buildDisclosureSummaryPrompt,
  DISCLOSURE_SUMMARY_JSON_SCHEMA,
  DISCLOSURE_SUMMARY_MAX_OUTPUT_TOKENS,
  DISCLOSURE_SUMMARY_SYSTEM_INSTRUCTION,
  parseDisclosureSummary,
} from "./disclosure-summary-contract";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 45_000;

type GeminiResponse = Readonly<{
  candidates?: readonly Readonly<{
    content?: Readonly<{ parts?: readonly Readonly<{ text?: string }>[] }>;
  }>[];
  usageMetadata?: Readonly<{ promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }>;
}>;

type GeminiErrorResponse = Readonly<{
  error?: Readonly<{ status?: string; message?: string }>;
}>;

export type AiProviderUsage = Readonly<{ inputTokens: number; outputTokens: number; totalTokens: number }>;

type Options = Readonly<{
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  onUsage?: (usage: AiProviderUsage) => void;
}>;

export class GeminiDisclosureSummaryClient implements AiDisclosureSummaryProvider {
  readonly providerName = "google";
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

  async assertAvailable(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}`,
        { headers: { "x-goog-api-key": this.apiKey }, signal: controller.signal },
      );
      if (!response.ok) throw new Error(await classifyResponse(response));
    } catch (error) {
      throw normalizeClientError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async summarize(candidate: AiAnalysisCandidate): Promise<GeneratedAiDisclosureSummaryCandidate> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          signal: controller.signal,
          body: JSON.stringify(buildRequest(candidate)),
        },
      );
      if (!response.ok) throw new Error(await classifyResponse(response));
      const body = await response.json() as GeminiResponse;
      if (body.usageMetadata) this.onUsage?.({
        inputTokens: body.usageMetadata.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: body.usageMetadata.totalTokenCount ?? 0,
      });
      const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!text) throw new Error("AI_INVALID_RESPONSE");
      const parsedJson: unknown = JSON.parse(text);
      return parseDisclosureSummary(parsedJson);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("AI_INVALID_RESPONSE");
      throw normalizeClientError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeClientError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") return new Error("AI_TIMEOUT");
  if (error instanceof TypeError) return new Error("AI_PROVIDER_UNAVAILABLE");
  return error instanceof Error ? error : new Error("AI_UPSTREAM_ERROR");
}

async function classifyResponse(response: Response): Promise<string> {
  const body = await response.clone().json().catch(() => null) as GeminiErrorResponse | null;
  const upstreamStatus = body?.error?.status;
  const upstreamMessage = body?.error?.message ?? "";
  if (/api key not valid|api key.*invalid/i.test(upstreamMessage)) return "AI_AUTH_ERROR";
  if (upstreamStatus === "UNAUTHENTICATED" || upstreamStatus === "PERMISSION_DENIED") return "AI_AUTH_ERROR";
  if (upstreamStatus === "RESOURCE_EXHAUSTED") return "AI_RATE_LIMITED";
  if (upstreamStatus === "NOT_FOUND") return "AI_MODEL_NOT_FOUND";
  if (upstreamStatus === "INVALID_ARGUMENT") return "AI_INVALID_REQUEST";
  if (upstreamStatus === "DEADLINE_EXCEEDED") return "AI_TIMEOUT";
  if (upstreamStatus === "UNAVAILABLE" || upstreamStatus === "INTERNAL") return "AI_PROVIDER_UNAVAILABLE";
  return classifyHttpStatus(response.status);
}

function classifyHttpStatus(status: number): string {
  if (status === 400 || status === 422) return "AI_INVALID_REQUEST";
  if (status === 401 || status === 403) return "AI_AUTH_ERROR";
  if (status === 404) return "AI_MODEL_NOT_FOUND";
  if (status === 408) return "AI_TIMEOUT";
  if (status === 429) return "AI_RATE_LIMITED";
  if (status >= 500) return "AI_PROVIDER_UNAVAILABLE";
  return "AI_UPSTREAM_ERROR";
}

function buildRequest(candidate: AiAnalysisCandidate) {
  return {
    systemInstruction: {
      parts: [{ text: DISCLOSURE_SUMMARY_SYSTEM_INSTRUCTION }],
    },
    contents: [{ role: "user", parts: [{ text: buildDisclosureSummaryPrompt(candidate) }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: DISCLOSURE_SUMMARY_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseSchema: removeUnsupportedGeminiSchemaKeywords(DISCLOSURE_SUMMARY_JSON_SCHEMA),
    },
  };
}

function removeUnsupportedGeminiSchemaKeywords(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeUnsupportedGeminiSchemaKeywords);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, child]) => [key, removeUnsupportedGeminiSchemaKeywords(child)]),
  );
}
