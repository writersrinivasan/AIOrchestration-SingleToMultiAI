import { Command } from "@langchain/langgraph";
import type { OrchestrationEvent } from "@/lib/agents";
import { buildGraph } from "@/lib/orchestrator/graph";
import { DEFAULT_MODEL } from "@/lib/orchestrator/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Body {
  query?: string;
  model?: string;
  threadId?: string;
  resume?: { approved: boolean; note?: string };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const model = body.model || DEFAULT_MODEL;
  const threadId = body.threadId || crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: OrchestrationEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const ts = () => Date.now();
      try {
        const graph = buildGraph(emit, model);
        const config = { configurable: { thread_id: threadId }, recursionLimit: 30 };

        let result;
        if (body.resume) {
          emit({ type: "run_start", ts: ts(), threadId, query: "", model, resumed: true });
          result = await graph.invoke(new Command({ resume: body.resume }), config);
        } else {
          const query = (body.query ?? "").trim().slice(0, 2000);
          if (!query) throw new Error("Empty query");
          emit({ type: "run_start", ts: ts(), threadId, query, model });
          emit({ type: "message", ts: ts(), from: "user", to: "orchestrator", content: query });
          result = await graph.invoke({ query }, config);
        }

        const interrupts = (result as { __interrupt__?: Array<{ value: unknown }> }).__interrupt__;
        if (interrupts?.length) {
          emit({
            type: "hitl_request",
            ts: ts(),
            threadId,
            reason: (result.proposal?.reasons ?? []).join("; "),
            summary: {
              claimId: result.fnol?.claimId,
              claimant: result.fnol?.claimantName,
              payout: result.proposal?.payout,
              fraudScore: result.risk?.score,
              estimate: result.repair?.estimate,
              rationale: result.proposal?.rationale,
              ...((interrupts[0].value as object) ?? {}),
            },
          });
        } else {
          emit({ type: "message", ts: ts(), from: "comms", to: "response", content: "Reply delivered to customer." });
          emit({
            type: "final",
            ts: ts(),
            answer: result.answer,
            decision: result.finalDecision,
            claimId: result.fnol?.claimId ?? null,
          });
        }
      } catch (err) {
        emit({ type: "error", ts: ts(), message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
