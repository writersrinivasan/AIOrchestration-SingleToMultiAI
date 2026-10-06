// Baseline for comparison: the "traditional GenAI" approach.
// One big prompt, one LLM call, no tools, no shared state, no specialists, no review.

import { callLLM, DEFAULT_MODEL } from "@/lib/orchestrator/llm";
import { TRADITIONAL_SYSTEM_PROMPT } from "@/lib/orchestrator/traditional";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query, model } = (await req.json()) as { query: string; model?: string };
  const t0 = Date.now();
  try {
    const { text, tokens } = await callLLM({
      agent: "traditional",
      model: model || DEFAULT_MODEL,
      system: TRADITIONAL_SYSTEM_PROMPT,
      user: query,
      temperature: 0.4,
      maxTokens: 600,
    });
    return Response.json({ answer: text, tokens, ms: Date.now() - t0, llmCalls: 1 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
