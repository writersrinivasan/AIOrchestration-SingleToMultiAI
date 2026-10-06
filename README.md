# ClaimFlow: Agentic AI Orchestration Demo

A multi-agent **motor insurance claims** system (FNOL → settlement) built with **Next.js 16**, **LangGraph.js** and **Groq**. It visualises in real time how the agents plan, delegate, call tools, run in parallel, critique each other and hand off to a human.

Built for a 2-hour masterclass on AI orchestration. The app includes the session agenda, concept pages, the use case, a live studio and a hands-on lab.

## Quick start

```bash
npm install
cp .env.example .env.local     # paste your GROQ_API_KEY (free at console.groq.com/keys)
npm run dev                    # http://localhost:3000
```

If no key is set, the app runs in **Simulation mode**. The graph, routing, tools, state, checkpoints and HITL are all real; only the LLM is replaced by rules. Use this as the fallback when venue Wi-Fi or rate limits fail. Force it with `CLAIMFLOW_MOCK=1`.

## Pages

| Route | Purpose |
|---|---|
| `/` | Session hub and the 120-minute agenda |
| `/learn` | Concepts: evolution, traditional GenAI vs. orchestration, patterns, LangGraph internals, production nuances |
| `/usecase` | Insurance claims use case: lifecycle → agent mapping, systems, KPIs, the six scenarios |
| `/studio` | **Live demo**: agent graph, message bus, inspector, side-by-side comparison with traditional GenAI, HITL |
| `/lab` | Hands-on exercises with solutions |

## Architecture

```
user ─▶ Orchestrator ─▶ Intake ─┬▶ Policy ─┐
            │                   ├▶ Fraud  ─┼▶ Settlement ⇄ Reviewer ─┬▶ Human ─▶ Comms ─▶ response
            │                   └▶ Damage ─┘                         └────────▶ Comms
            └──(guardrail: out of scope)──────────────────────────────────────▶ Comms
```

| Pattern | Where |
|---|---|
| Supervisor / router | `orchestrator` classifies intent and picks specialists |
| Parallel fan-out / fan-in | `intake` → policy ∥ fraud ∥ damage → `settlement` |
| Tool-grounded reasoning | `src/lib/orchestrator/tools.ts` (rules and money are calculated in code, never by the LLM) |
| Reflection loop | `reviewer` → `settlement` (bounded by `MAX_REVISIONS`) |
| Human-in-the-loop | `human` node uses `interrupt()`; resumed with `Command({ resume })` via the checkpointer |
| Guardrail short-circuit | `OUT_OF_SCOPE` routes straight to `comms` |

### Key files

```
src/lib/agents.ts                 Agent metadata, graph edges, event types, sample prompts (shared client/server)
src/lib/orchestrator/graph.ts     The LangGraph StateGraph: state, agents, routers
src/lib/orchestrator/tools.ts     Deterministic tools + business-rule constants
src/lib/orchestrator/data.ts      Mock systems of record (policies, claims history, parts catalogue, FAQ)
src/lib/orchestrator/llm.ts       Groq wrapper with telemetry
src/lib/orchestrator/mock.ts      Simulation-mode LLM stand-in
src/app/api/orchestrate/route.ts  Streams NDJSON events; handles HITL resume
src/app/api/traditional/route.ts  Single-prompt baseline for comparison
src/components/AgentGraph.tsx     React Flow visualisation
src/lib/useOrchestration.ts       Client reducer: events → graph state, metrics, replay
labs/solutions/                   Tested lab solutions (git apply)
docs/SESSION_PLAN.md              Presenter run sheet
```

### How the UI sees agent communication

Every agent and router emits events (`agent_start`, `message`, `tool_call`, `llm_call`, `agent_end`, `hitl_request`, `final`). They are streamed as NDJSON from `/api/orchestrate`. The client reducer turns them into node and edge states, an animated message "packet" on each edge, the message bus, and the metrics.

## Notes for production

- `MemorySaver` is in-memory, so HITL resume needs the same server process. That's fine for `npm run dev` / `npm start`. On serverless, use a persistent checkpointer such as `@langchain/langgraph-checkpoint-postgres`.
- The groq-sdk retries 429s automatically. On the free tier, one claim is about 8 LLM calls, so avoid having the whole room hammer one key at the same moment. Attendees should use their own keys.
