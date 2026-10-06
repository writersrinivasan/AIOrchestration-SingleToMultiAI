import Groq from "groq-sdk";
import type { AgentId, OrchestrationEvent } from "../agents";
import { isMockMode, mockLLM } from "./mock";

export const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Used when the configured default isn't available on the account (Groq retires models over time).
export const FALLBACK_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"];

// Reasoning models spend completion tokens on hidden reasoning; keep it short for agent steps.
const isReasoningModel = (m: string) => /gpt-oss|qwen3/i.test(m);

let client: Groq | null = null;
export function groq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set. Copy .env.example to .env.local and add your key from console.groq.com.");
  }
  // SDK retries 429/5xx with backoff, which matters on free-tier rate limits.
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 4 });
  return client;
}

export type Emit = (e: OrchestrationEvent) => void;

interface CallOptions {
  agent: AgentId | "traditional";
  model: string;
  system: string;
  user: string;
  emit?: Emit;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export async function callLLM(opts: CallOptions): Promise<{ text: string; tokens: number }> {
  const t0 = Date.now();
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 900));
    const text = mockLLM(opts.agent, opts.user);
    const promptTokens = Math.round((opts.system.length + opts.user.length) / 4);
    const completionTokens = Math.round(text.length / 4);
    if (opts.agent !== "traditional")
      opts.emit?.({ type: "llm_call", ts: Date.now(), agent: opts.agent, model: `${opts.model} (simulated)`, promptTokens, completionTokens, ms: Date.now() - t0, system: opts.system, user: opts.user, response: text });
    return { text, tokens: promptTokens + completionTokens };
  }
  const res = await groq().chat.completions.create({
    model: opts.model,
    temperature: opts.temperature ?? 0.2,
    max_completion_tokens: (opts.maxTokens ?? 700) + (isReasoningModel(opts.model) ? 1500 : 0),
    ...(isReasoningModel(opts.model) ? { reasoning_effort: (/qwen/i.test(opts.model) ? "none" : "low") as "low" | "none" } : {}),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = res.choices[0]?.message?.content ?? "";
  const usage = res.usage;
  if (opts.agent !== "traditional")
    opts.emit?.({
      type: "llm_call",
      ts: Date.now(),
      agent: opts.agent,
      model: opts.model,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      ms: Date.now() - t0,
      system: opts.system,
      user: opts.user,
      response: text,
    });
  return { text, tokens: usage?.total_tokens ?? 0 };
}

export async function callJSON<T>(opts: Omit<CallOptions, "json">): Promise<T> {
  const { text } = await callLLM({ ...opts, json: true });
  return parseJSON<T>(text);
}

export function parseJSON<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error(`Model did not return valid JSON: ${cleaned.slice(0, 200)}`);
  }
}
