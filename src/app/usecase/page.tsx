import Link from "next/link";
import { AGENTS, type AgentId } from "@/lib/agents";
import { POLICIES } from "@/lib/orchestrator/data";

const LIFECYCLE: Array<{ stage: string; agent: AgentId; today: string; agentic: string }> = [
  { stage: "First Notice of Loss", agent: "intake", today: "Call-centre agent re-keys the customer's story into a form", agentic: "Structured FNOL record extracted in seconds, with missing fields flagged" },
  { stage: "Triage & routing", agent: "orchestrator", today: "Supervisor manually assigns a queue", agentic: "Intent-based plan; only the needed specialists are engaged" },
  { stage: "Coverage verification", agent: "policy", today: "Adjuster opens the policy system and reads the clauses", agentic: "Policy pulled by tool, hard rules checked in code, LLM explains" },
  { stage: "Fraud screening (SIU)", agent: "fraud", today: "Batch rules run overnight; narrative rarely read", agentic: "Rules + LLM narrative analysis in real time, with an explainable score" },
  { stage: "Damage appraisal", agent: "damage", today: "Appraiser visit or a separate estimating system", agentic: "Catalogue-priced estimate, severity and total-loss flag" },
  { stage: "Settlement decision", agent: "settlement", today: "Adjuster calculates payout by hand", agentic: "Deterministic payout engine; LLM writes the rationale" },
  { stage: "Compliance QA", agent: "reviewer", today: "Sample-based QA weeks later", agentic: "Every decision audited before it goes out; can force a revision" },
  { stage: "Authority / approval", agent: "human", today: "Everything waits in an approval queue", agentic: "Only high-risk/high-value claims pause for a human" },
  { stage: "Customer communication", agent: "comms", today: "Template letter, often days later", agentic: "Personalised, compliant reply generated from verified facts" },
];

const KPIS: Array<[string, string, string]> = [
  ["Cycle time (simple claim)", "Days", "Minutes"],
  ["Straight-through processing rate", "Low", "Majority of simple claims"],
  ["Adjuster time per claim", "Hours", "Exceptions only"],
  ["Fraud screening coverage", "Sampled / batch", "100%, real time"],
  ["Decision consistency", "Varies by adjuster", "Same rules every time"],
  ["Audit evidence", "Notes in free text", "Full machine-readable trace"],
];

const SCENARIOS: Array<{ name: string; path: string; teaches: string }> = [
  { name: "Priya, POL-1001: rear-ended, police report", path: "Orchestrator → Intake → (Policy ∥ Fraud ∥ Damage) → Settlement → Reviewer → Comms", teaches: "Happy path, parallel fan-out, straight-through approval" },
  { name: "Marcus, POL-1004: BMW, airbags, no report, 'pay today'", path: "… → Settlement (HUMAN_REVIEW) → Reviewer → ⏸ Human → Comms", teaches: "Fraud signals (new policy, claim frequency, urgency), HITL interrupt and resume" },
  { name: "Emily, POL-1003: vandalism, lapsed policy", path: "… → Policy (hard rule fail) → Settlement (DENY) → …", teaches: "Deterministic guardrail beats the LLM; traditional GenAI usually misses the lapse" },
  { name: "Rahul, POL-1002: 'am I covered if I hit a wall?'", path: "Orchestrator → Intake → Policy → Comms", teaches: "Dynamic routing: 5 agents skipped, cheaper and faster" },
  { name: "General FAQ: documents & timelines", path: "Orchestrator → Intake → Comms (+FAQ tool)", teaches: "Minimal path, grounded on a knowledge base" },
  { name: "Off-topic + data exfiltration attempt", path: "Orchestrator → Comms", teaches: "Supervisor guardrail short-circuits before any tool is touched" },
];

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function UseCasePage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-14 px-4 py-10">
      <header>
        <div className="text-sm text-accent-2">Part 2 · Industrial use case</div>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Motor insurance claims: FNOL to settlement</h1>
        <p className="mt-3 max-w-3xl text-muted">
          Claims is the &ldquo;moment of truth&rdquo; for an insurer. It decides customer satisfaction, loss ratio and regulatory exposure.
          It is also a textbook multi-agent problem: unstructured input, several systems of record, specialist judgement, hard rules,
          fraud risk, and a human authority matrix. The same pattern carries over to banking (loan origination), healthcare (prior
          authorisation), manufacturing (maintenance work orders) and airlines (disruption management).
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["😣 The pain today", "Manual re-keying, queue hand-offs between teams, days of cycle time, inconsistent decisions, and fraud screening that is sampled rather than universal."],
          ["🤖 Why one big prompt fails", "It can't see the policy, history or price lists, so it invents coverage and amounts. It can't apply authority limits, can't be audited, and gives a different answer every run."],
          ["🚀 What orchestration changes", "Each claims role becomes an agent with its own tools and permissions. Rules run in code, humans see only exceptions, and every decision carries its evidence."],
        ].map(([t, b]) => (
          <div key={t} className="card p-5">
            <div className="text-lg font-semibold">{t}</div>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Claim lifecycle → agent mapping</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="p-3 font-medium">Stage</th>
                <th className="p-3 font-medium">Agent</th>
                <th className="p-3 font-medium">Today (manual / traditional)</th>
                <th className="p-3 font-medium text-accent">With orchestration</th>
              </tr>
            </thead>
            <tbody>
              {LIFECYCLE.map((r) => {
                const a = AGENTS[r.agent];
                return (
                  <tr key={r.stage} className="border-b border-line/60 last:border-0">
                    <td className="p-3 font-medium">{r.stage}</td>
                    <td className="p-3 whitespace-nowrap" style={{ color: a.color }}>
                      {a.icon} {a.name}
                    </td>
                    <td className="p-3 text-muted">{r.today}</td>
                    <td className="p-3">{r.agentic}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Enterprise systems the agents use</h2>
          <div className="space-y-2">
            {[
              ["Policy admin system", "getPolicy · checkCoverageRules", "Policy Agent"],
              ["Claims history / SIU database", "getClaimHistory · runFraudRules", "Fraud Agent"],
              ["Parts & labour pricing", "estimateRepairCost", "Damage Agent"],
              ["Payout / authority engine", "calculatePayout", "Settlement Agent"],
              ["Knowledge base", "searchClaimsFAQ", "Comms Agent"],
            ].map(([sys, tools, agent]) => (
              <div key={sys} className="flex items-center gap-3 rounded-lg border border-line p-3 text-sm">
                <span className="w-56 font-medium">{sys}</span>
                <span className="font-mono text-xs text-accent-2">{tools}</span>
                <span className="ml-auto text-xs text-muted">{agent}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Mocked here in <code className="font-mono">src/lib/orchestrator/data.ts</code>. In a real deployment these would be APIs into a core
            insurance platform such as a policy and claims suite, typically exposed to agents via MCP servers.
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Outcome levers</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="p-3 font-medium">KPI</th>
                  <th className="p-3 font-medium">Typical manual process</th>
                  <th className="p-3 font-medium text-accent">Target with agents</th>
                </tr>
              </thead>
              <tbody>
                {KPIS.map(([k, a, b]) => (
                  <tr key={k} className="border-b border-line/60 last:border-0">
                    <td className="p-3">{k}</td>
                    <td className="p-3 text-muted">{a}</td>
                    <td className="p-3 font-medium">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Directional targets for discussion. Validate them against a client baseline before quoting numbers.</p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Demo data: the policyholders</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Object.values(POLICIES).map((p) => (
            <div key={p.policyId} className="card p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{p.policyId}</span>
                <span className={`rounded px-1.5 text-[11px] ${p.status === "ACTIVE" ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad"}`}>{p.status}</span>
              </div>
              <div className="mt-1 font-medium">{p.holder}</div>
              <div className="text-muted">{p.vehicle}</div>
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                <div>Plan: <span className="text-ink">{p.plan.replaceAll("_", " ")}</span></div>
                <div>Deductible {usd(p.deductible)} · Limit {usd(p.limit)}</div>
                <div>Period {p.startDate} → {p.endDate}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Six scenarios, six orchestration paths</h2>
        <div className="space-y-2">
          {SCENARIOS.map((s, i) => (
            <div key={s.name} className="card grid gap-2 p-4 md:grid-cols-[28px_1.1fr_1.4fr_1fr]">
              <span className="font-mono text-accent">{i + 1}</span>
              <span className="font-medium">{s.name}</span>
              <span className="font-mono text-xs text-accent-2">{s.path}</span>
              <span className="text-sm text-muted">{s.teaches}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Link href="/studio" className="rounded-lg bg-accent px-5 py-2.5 font-semibold">
          Run it live in the Studio →
        </Link>
      </div>
    </main>
  );
}
