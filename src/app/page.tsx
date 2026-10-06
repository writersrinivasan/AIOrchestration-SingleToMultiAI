import Link from "next/link";

const AGENDA = [
  {
    t: "0:00 – 0:10",
    title: "Opening hook: one prompt vs. a team of agents",
    body: "Run the same claim through traditional GenAI and through the orchestrated system, side by side. Ask the room which one they would put in production.",
    href: "/studio",
  },
  {
    t: "0:10 – 0:35",
    title: "Concepts: from GenAI automation to agentic orchestration",
    body: "How automation evolved, the anatomy of an agent, 8 orchestration patterns, LangGraph internals, and a 16-point comparison.",
    href: "/learn",
  },
  {
    t: "0:35 – 0:50",
    title: "Industrial use case: motor insurance claims (FNOL → settlement)",
    body: "Business pain, agent-to-lifecycle mapping, enterprise systems, KPIs, and the six demo scenarios.",
    href: "/usecase",
  },
  {
    t: "0:50 – 1:20",
    title: "Live studio deep dive",
    body: "Every hop, message, tool call, LLM prompt, parallel fan-out, critic loop and human-in-the-loop pause, made visible.",
    href: "/studio",
  },
  {
    t: "1:20 – 1:50",
    title: "Hands-on lab",
    body: "Observe → change a business rule → add a new agent → tune routing and models. Every exercise has a solution.",
    href: "/lab",
  },
  {
    t: "1:50 – 2:00",
    title: "Production realities, ROI, Q&A",
    body: "Cost, latency, failure modes, governance, when not to use agents, and the path from pilot to platform.",
    href: "/learn#production",
  },
];

const PILLARS = [
  ["🧠", "Plan", "A supervisor decomposes the goal and routes work dynamically, not through a hard-coded script."],
  ["🛠️", "Act with tools", "Agents call real systems (policy admin, claims history, pricing), so the numbers come from data rather than the model's guesses."],
  ["🔀", "Collaborate", "Specialists work in parallel and hand off typed messages over shared state."],
  ["⚖️", "Self-correct", "A critic agent audits decisions and loops back for revision."],
  ["🧑‍💼", "Stay governed", "Humans approve high-risk steps; every hop is logged for audit."],
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
          Hexaware · 2-hour masterclass · AI Orchestration
        </div>
        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          From a single prompt to a{" "}
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">team of AI agents</span>
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted">
          An end-to-end look at agentic AI orchestration through a real industry workflow: motor insurance claims. Built with{" "}
          <b className="text-ink">Next.js</b>, <b className="text-ink">LangGraph.js</b> and <b className="text-ink">Groq</b>. Every
          step of the agents&apos; work is visible as it happens.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/studio" className="rounded-lg bg-accent px-5 py-2.5 font-semibold hover:brightness-110">
            ▶ Open Live Studio
          </Link>
          <Link href="/learn" className="rounded-lg border border-line px-5 py-2.5 hover:border-accent">
            Start with concepts
          </Link>
        </div>
      </section>

      <section className="mb-12 grid gap-3 md:grid-cols-5">
        {PILLARS.map(([icon, title, body]) => (
          <div key={title} className="card p-4">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">Session agenda (120 min)</h2>
        <ol className="relative space-y-3 border-l border-line pl-6">
          {AGENDA.map((a) => (
            <li key={a.t} className="relative">
              <span className="absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-accent bg-bg" />
              <Link href={a.href} className="card block p-4 transition hover:border-accent">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-sm text-accent-2">{a.t}</span>
                  <span className="font-semibold">{a.title}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{a.body}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="card grid gap-6 p-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">What the audience will leave with</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/85">
            <li>✓ A mental model for when to use a prompt, a chain, a single agent, or a multi-agent system</li>
            <li>✓ The 8 core orchestration patterns, and how to recognise them in a live system</li>
            <li>✓ How agents actually communicate: shared state, typed handoffs, routers</li>
            <li>✓ How to keep agentic systems safe: tool grounding, guardrails, critics, HITL, audit trails</li>
            <li>✓ Hands-on experience extending a working LangGraph system</li>
          </ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Stack</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {[
              ["Next.js 16", "App Router · streaming route handlers"],
              ["LangGraph.js", "StateGraph · checkpointer · interrupt"],
              ["Groq", "LPU inference: fast enough to run agent chains live"],
              ["React Flow", "Live agent topology visualisation"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line p-3">
                <div className="font-semibold">{k}</div>
                <div className="text-xs text-muted">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
