import Link from "next/link";

const EVOLUTION = [
  { stage: "Rules & RPA", era: "2010s", how: "If-then scripts and screen bots", limit: "Breaks on unstructured input and any process change", color: "#64748b" },
  { stage: "Traditional GenAI", era: "2023", how: "One prompt in, text out (maybe a fixed chain)", limit: "No data access, no actions, unverifiable output", color: "#38bdf8" },
  { stage: "RAG", era: "2023–24", how: "Retrieve documents, then generate", limit: "Read-only knowledge; still one shot, no decisions", color: "#34d399" },
  { stage: "Single agent", era: "2024", how: "LLM loop that calls tools", limit: "One brain doing everything; prompt bloat; hard to govern", color: "#fbbf24" },
  { stage: "Multi-agent orchestration", era: "2025+", how: "Specialist agents + supervisor + shared state + HITL", limit: "Needs engineering discipline: state, evals, observability", color: "#a78bfa" },
];

const COMPARISON: Array<[string, string, string]> = [
  ["Unit of work", "A prompt", "A goal, decomposed into tasks"],
  ["Control flow", "Fixed: prompt → answer (or a hard-coded chain)", "Dynamic: a supervisor routes at run time based on state"],
  ["Specialisation", "One generalist prompt does everything", "Each agent has a narrow role, prompt, tools and permissions"],
  ["Enterprise data", "Only what fits in the prompt; otherwise hallucinated", "Tools query systems of record on demand"],
  ["Business rules", "Written in the prompt as English, followed only loosely", "Enforced in deterministic code; the LLM explains, it doesn't calculate"],
  ["Parallelism", "Sequential, a single call", "Independent agents fan out in parallel, then fan in"],
  ["Memory / state", "Chat history string", "Typed, shared state (blackboard) plus checkpoints"],
  ["Error handling", "Retry the whole prompt", "Retry, reroute or revise one step; recursion limits"],
  ["Quality control", "Hope, or a human reads everything", "Critic / reviewer agents with reflection loops"],
  ["Human oversight", "All-or-nothing", "Targeted interrupts on high-risk steps, then resume"],
  ["Explainability", "Final text only", "Every hop, message, tool call and prompt is traceable"],
  ["Change management", "Rewrite the mega-prompt and re-test everything", "Change one agent, tool or edge in isolation"],
  ["Cost profile", "Small, but large prompts as scope grows", "More calls, but each can use a right-sized model"],
  ["Latency", "One call", "Several calls; parallelism and fast inference (Groq) compensate"],
  ["Testing", "End-to-end eyeballing", "Unit-test tools, eval each agent, trace the graph"],
  ["Best for", "Drafting, summarising, Q&A", "Multi-step, multi-system, decision-making workflows"],
];

const PATTERNS = [
  { name: "Sequential pipeline", icon: "➡️", what: "Agents run in a fixed order, each enriching the state.", where: "Orchestrator → Intake", diagram: "A ─▶ B ─▶ C" },
  { name: "Supervisor / router", icon: "🧠", what: "An LLM supervisor classifies the goal and decides which agents run.", where: "Orchestrator picks specialists per intent", diagram: "    ┌▶ B\nS ──┼▶ C\n    └▶ D" },
  { name: "Parallel fan-out / fan-in", icon: "🔀", what: "Independent tasks run concurrently, then an aggregator joins them.", where: "Policy ∥ Fraud ∥ Damage → Settlement", diagram: "  ┌▶ B ┐\nA ┼▶ C ┼▶ E\n  └▶ D ┘" },
  { name: "Reflection / critic loop", icon: "⚖️", what: "A reviewer critiques output and sends it back with feedback (bounded).", where: "Reviewer ⇄ Settlement (max 1 revision)", diagram: "B ─▶ R\n▲    │\n└─fix┘" },
  { name: "Human-in-the-loop", icon: "🧑‍💼", what: "The graph pauses with state checkpointed and resumes on a human decision.", where: "Adjuster approval for high-risk claims", diagram: "A ─▶ ⏸ ─▶ B\n     👤" },
  { name: "Tool-grounded agent", icon: "🛠️", what: "The LLM decides what to call; deterministic code computes the facts.", where: "calculatePayout, checkCoverageRules", diagram: "LLM ⇄ tool()\n  ▼\nfacts" },
  { name: "Blackboard (shared state)", icon: "📋", what: "Agents communicate by reading and writing a typed shared state, not by long chat transcripts.", where: "ClaimState: fnol, coverage, risk, repair…", diagram: "A ─┐\nB ─┼─▶ [STATE]\nC ─┘" },
  { name: "Guardrail / short-circuit", icon: "🛡️", what: "Out-of-scope or unsafe requests are routed away before any work happens.", where: "OUT_OF_SCOPE → straight to Comms", diagram: "S ─✗─▶ …\n└──▶ refuse" },
];

const NUANCES = [
  {
    title: "Determinism where it matters",
    body: "LLMs reason, route and explain; code calculates. Payouts, coverage rules and fraud thresholds live in tools, so the LLM can never invent a number. In this demo the Policy Agent cannot override a hard rule failure, even if the LLM says it is covered.",
  },
  {
    title: "Context engineering",
    body: "Each agent sees only the state slice it needs (open the Inspector and see 'input'). Smaller prompts are cheaper and faster, and an agent can't be distracted by information it never receives.",
  },
  {
    title: "Bounded loops",
    body: "Critics can loop forever. Cap revisions (MAX_REVISIONS = 1) and set a graph recursionLimit. On the final round, tell the critic to approve unless there is a material breach.",
  },
  {
    title: "Cascading errors",
    body: "A bad extraction upstream poisons everything downstream. Validate at the boundaries: regex-check the policy ID, filter parts to the catalogue, and list missing fields explicitly.",
  },
  {
    title: "Cost & latency budget",
    body: "A run makes 6–9 LLM calls instead of 1. Mitigate with parallel fan-out, right-sized models per agent (a 20B model for extraction, a 120B model for judgement), skipping agents that aren't needed, and fast inference. Groq makes this practical to run live.",
  },
  {
    title: "Security & least privilege",
    body: "Each agent gets only its tools. The Comms Agent never sees fraud internals. A supervisor guardrail blocks prompt injection and cross-customer data requests before they reach any tool.",
  },
  {
    title: "Observability & audit",
    body: "Emit an event for every hop, tool call and LLM call (the Message Bus). In regulated industries such as insurance and banking, this trace is your compliance evidence.",
  },
  {
    title: "Durability & HITL",
    body: "Checkpointing makes long-running, pausable workflows possible: pause for a human for hours, resume exactly where you left off. In production, use a persistent checkpointer (Postgres or Redis), not in-memory.",
  },
  {
    title: "Evaluation",
    body: "Test each agent with golden datasets (intake extraction accuracy, fraud precision/recall), plus end-to-end scenario tests. The six demo scenarios form a minimal regression suite.",
  },
  {
    title: "When NOT to use agents",
    body: "If the task is single-step, latency-critical or fully deterministic, a prompt or plain code wins. Use agents where there are decisions, multiple systems and branching.",
  },
];

const FRAMEWORKS: Array<[string, string]> = [
  ["LangGraph", "Graph/state-machine orchestration with checkpoints, interrupts and streaming. Used in this demo (JS & Python)."],
  ["CrewAI", "Role-based 'crews' of agents with tasks and processes; quick to prototype."],
  ["Microsoft Agent Framework / AutoGen", "Conversational multi-agent patterns and enterprise integration with the Azure ecosystem."],
  ["OpenAI Agents SDK", "Lightweight agents, handoffs and guardrails."],
  ["Google ADK", "Agent Development Kit: hierarchical agents, integrates with Vertex AI."],
  ["LlamaIndex Workflows", "Event-driven workflows, strong on data/RAG agents."],
  ["MCP (protocol)", "Model Context Protocol: a standard way to expose tools and data to any agent."],
  ["A2A (protocol)", "Agent-to-Agent protocol: lets agents built on different frameworks and vendors discover and message each other."],
];

const CODE = `// 1. Shared state — the blackboard every agent reads/writes
const ClaimState = Annotation.Root({
  fnol: Annotation<Intake>(), coverage: Annotation<PolicyResult>(),
  risk: Annotation<FraudResult>(), repair: Annotation<DamageResult>(), ...
});

// 2. Agents are nodes; routers are conditional edges
new StateGraph(ClaimState)
  .addNode("orchestrator", orchestrator)     // supervisor
  .addNode("intake", intake)                 // extraction
  .addNode("policy", policy).addNode("fraud", fraud).addNode("damage", damage)
  .addNode("settlement", settlement)         // fan-in
  .addNode("reviewer", reviewer)             // critic
  .addNode("human", human)                   // interrupt()
  .addNode("comms", comms)
  .addEdge(START, "orchestrator")
  .addConditionalEdges("intake", (s) => s.plan.agents)  // ← parallel fan-out
  .addConditionalEdges("reviewer", (s) =>
      !s.review.approved ? "settlement"                   // ← reflection loop
    : s.proposal.decision === "HUMAN_REVIEW" ? "human"    // ← HITL
    : "comms")
  .compile({ checkpointer });                             // ← durable, resumable`;

export default function LearnPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10">
      <header>
        <div className="text-sm text-accent-2">Part 1 · Concepts</div>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">From GenAI automation to agentic orchestration</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Traditional GenAI makes a model answer. Orchestration makes a system of models, tools and people complete a business outcome
          reliably, observably and under governance.
        </p>
      </header>

      {/* Evolution */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">1. The evolution of automation</h2>
        <div className="grid gap-3 md:grid-cols-5">
          {EVOLUTION.map((e, i) => (
            <div key={e.stage} className="card relative p-4" style={{ borderTop: `3px solid ${e.color}` }}>
              <div className="font-mono text-xs text-muted">
                {i + 1} · {e.era}
              </div>
              <div className="mt-1 font-semibold">{e.stage}</div>
              <p className="mt-2 text-sm text-ink/85">{e.how}</p>
              <p className="mt-2 text-xs text-bad/90">Limit: {e.limit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="compare">
        <h2 className="mb-4 text-2xl font-semibold">2. Traditional GenAI automation vs. agentic orchestration</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="p-3 font-medium text-muted">Dimension</th>
                <th className="p-3 font-medium">Traditional GenAI</th>
                <th className="p-3 font-medium text-accent">Agentic orchestration</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([d, a, b]) => (
                <tr key={d} className="border-b border-line/60 last:border-0">
                  <td className="p-3 font-medium text-muted">{d}</td>
                  <td className="p-3 text-ink/80">{a}</td>
                  <td className="p-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Show it live: in the <Link href="/studio" className="text-accent underline">Studio</Link>, keep “Compare vs traditional” on and open the{" "}
          <b>Compare</b> tab. The fact check scores the single-prompt reply against facts the agents verified.
        </p>
      </section>

      {/* Anatomy */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">3. Anatomy of an agent</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["🎭 Role & goal", "A narrow responsibility: “verify coverage”, not “handle claims”."],
            ["🧠 Reasoning (LLM)", "Interprets, decides and explains. Model size is chosen per role."],
            ["🛠️ Tools", "Typed functions into enterprise systems: APIs, databases, rules engines."],
            ["📋 State / memory", "Reads and writes a typed slice of the shared state; checkpointed."],
            ["🛡️ Guardrails", "Validation, permissions, deterministic overrides, output schemas (JSON)."],
            ["📨 Handoff protocol", "What it passes to whom, and under which condition (the routers / edges)."],
          ].map(([t, b]) => (
            <div key={t} className="card p-4">
              <div className="font-semibold">{t}</div>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Patterns */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">4. Orchestration patterns, all live in the demo</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PATTERNS.map((p) => (
            <div key={p.name} className="card flex flex-col p-4">
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-xl">{p.icon}</span>
                {p.name}
              </div>
              <pre className="my-3 rounded-md bg-black/30 p-2 font-mono text-[11px] leading-tight text-accent-2">{p.diagram}</pre>
              <p className="text-sm text-ink/85">{p.what}</p>
              <p className="mt-auto pt-2 text-xs text-muted">
                In ClaimFlow: <span className="text-ink">{p.where}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How agents communicate */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">5. How the agents actually communicate</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-3 p-5 text-sm">
            <p>
              <b>Shared state (blackboard).</b> Agents don&apos;t chat in long transcripts. Each node returns a <i>partial state update</i> (for example{" "}
              <code className="font-mono text-accent-2">{"{ risk: {...} }"}</code>), and LangGraph merges it into the shared state with reducers.
            </p>
            <p>
              <b>Routers = handoffs.</b> After a node finishes, its conditional edge inspects the state and decides the next agent(s). Returning
              an <i>array</i> fans out in parallel. In this app every router also publishes a human-readable A2A message so you can watch the handoff.
            </p>
            <p>
              <b>Supersteps.</b> LangGraph runs in Pregel-style supersteps: all nodes scheduled for a step run concurrently, their updates are
              applied, then the next step is scheduled. That&apos;s why Settlement runs exactly <i>once</i> after all three specialists finish.
            </p>
            <p>
              <b>Checkpoints.</b> State is saved after every superstep, so <code className="font-mono">interrupt()</code> can pause the graph
              and a later request can resume with <code className="font-mono">Command({"{ resume }"})</code>.
            </p>
          </div>
          <pre className="card scroll-thin overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-ink/90">{CODE}</pre>
        </div>
      </section>

      {/* Nuances */}
      <section id="production">
        <h2 className="mb-4 text-2xl font-semibold">6. Production nuances: what separates a demo from a platform</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {NUANCES.map((n) => (
            <div key={n.title} className="card p-4">
              <div className="font-semibold">{n.title}</div>
              <p className="mt-1 text-sm text-muted">{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Frameworks */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">7. Framework & protocol landscape</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {FRAMEWORKS.map(([k, v]) => (
            <div key={k} className="flex gap-3 rounded-lg border border-line p-3">
              <div className="w-44 shrink-0 font-semibold">{k}</div>
              <div className="text-sm text-muted">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The patterns transfer across frameworks. Learn them once and you can apply them with any of these tools.
        </p>
      </section>

      <div className="flex justify-end">
        <Link href="/usecase" className="rounded-lg bg-accent px-5 py-2.5 font-semibold">
          Next: the industrial use case →
        </Link>
      </div>
    </main>
  );
}
