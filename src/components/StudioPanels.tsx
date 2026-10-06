"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { AGENTS, type AgentId, type NodeId, type OrchestrationEvent } from "@/lib/agents";
import { computeMetrics, type RunState } from "@/lib/useOrchestration";

export const Markdown = ({ children }: { children: string }) => (
  <div className="prose-chat text-sm leading-relaxed">
    <ReactMarkdown>{children}</ReactMarkdown>
  </div>
);

const fmtS = (ms: number) => `${(ms / 1000).toFixed(2)}s`;

export function AgentChip({ id, small }: { id: NodeId; small?: boolean }) {
  const m = AGENTS[id];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 ${small ? "text-[10px]" : "text-[11px]"} font-medium`}
      style={{ borderColor: `${m.color}66`, background: `${m.color}18`, color: m.color }}
    >
      {m.icon} {m.name}
    </span>
  );
}

// ---------------- Metrics ----------------

export function MetricsBar({ run }: { run: RunState }) {
  const m = computeMetrics(run);
  const saved = Math.max(0, m.sequentialMs - m.wallMs);
  const tiles: Array<[string, string, string?]> = [
    ["Agents engaged", `${m.agentsUsed}`],
    ["A2A messages", `${m.messages}`],
    ["LLM calls", `${m.llmCalls}`],
    ["Tool calls", `${m.toolCalls}`, "deterministic, grounded"],
    ["Tokens", `${(m.promptTokens + m.completionTokens).toLocaleString()}`, `${m.promptTokens.toLocaleString()} in · ${m.completionTokens.toLocaleString()} out`],
    ["Wall time", fmtS(m.wallMs), "excludes human wait"],
    ["Σ agent time", fmtS(m.sequentialMs), "if run sequentially"],
    ["Parallelism saved", saved > 0 ? fmtS(saved) : "—", "fan-out benefit"],
    ["Revisions", `${m.revisions}`, "reflection loops"],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
      {tiles.map(([k, v, hint]) => (
        <div key={k} className="rounded-lg border border-line bg-panel px-2.5 py-1.5" title={hint}>
          <div className="text-[10px] uppercase tracking-wide text-muted">{k}</div>
          <div className="font-mono text-base font-semibold tabular-nums">{v}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------- Message bus ----------------

export function MessageBus({ run, onSelect }: { run: RunState; onSelect: (id: NodeId) => void }) {
  const [show, setShow] = useState({ message: true, tool_call: true, llm_call: false, agent: true });
  const t0 = run.events[0]?.ts ?? 0;
  const items = run.events.filter(
    (e) =>
      (e.type === "message" && show.message) ||
      (e.type === "tool_call" && show.tool_call) ||
      (e.type === "llm_call" && show.llm_call) ||
      ((e.type === "agent_start" || e.type === "agent_end" || e.type === "skip") && show.agent) ||
      e.type === "hitl_request" ||
      e.type === "error",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-2 text-[11px]">
        {(
          [
            ["message", "A2A messages"],
            ["agent", "Agent lifecycle"],
            ["tool_call", "Tool calls"],
            ["llm_call", "LLM calls"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
            className={`rounded-md border px-2 py-0.5 ${show[k] ? "border-accent bg-accent/20 text-white" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="scroll-thin flex-1 space-y-1.5 overflow-y-auto p-2">
        {!items.length && <p className="p-4 text-center text-sm text-muted">The agent-to-agent message bus appears here.</p>}
        {items.map((e, i) => (
          <BusItem key={i} e={e} t={(e.ts - t0) / 1000} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function BusItem({ e, t, onSelect }: { e: OrchestrationEvent; t: number; onSelect: (id: NodeId) => void }) {
  const time = <span className="font-mono text-[10px] text-muted">+{t.toFixed(2)}s</span>;
  switch (e.type) {
    case "message":
      return (
        <button onClick={() => onSelect(e.to)} className="fade-in w-full rounded-lg border border-line bg-panel-2/60 p-2 text-left hover:border-accent/60">
          <div className="flex flex-wrap items-center gap-1">
            <AgentChip id={e.from} small /> <span className="text-muted">→</span> <AgentChip id={e.to} small />
            <span className="ml-auto">{time}</span>
          </div>
          <div className="mt-1 text-[12px] leading-snug text-ink/90">{e.content}</div>
        </button>
      );
    case "tool_call":
      return (
        <button onClick={() => onSelect(e.agent)} className="fade-in flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-panel-2">
          <span className="text-muted">⚙</span>
          <AgentChip id={e.agent} small />
          <span className="font-mono text-accent-2">{e.tool}()</span>
          <span className="ml-auto">{time}</span>
        </button>
      );
    case "llm_call":
      return (
        <button onClick={() => onSelect(e.agent)} className="fade-in flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-panel-2">
          <span>✨</span>
          <AgentChip id={e.agent} small />
          <span className="text-muted">
            LLM {e.promptTokens}+{e.completionTokens} tok · {fmtS(e.ms)}
          </span>
          <span className="ml-auto">{time}</span>
        </button>
      );
    case "agent_start":
      return (
        <div className="fade-in flex items-start gap-2 px-2 py-0.5 text-[11px] text-muted">
          <span>▶</span>
          <span>
            <b style={{ color: AGENTS[e.agent].color }}>{AGENTS[e.agent].name}</b> started
          </span>
          <span className="ml-auto">{time}</span>
        </div>
      );
    case "agent_end":
      return (
        <div className="fade-in flex items-start gap-2 px-2 py-0.5 text-[11px] text-muted">
          <span className="text-ok">■</span>
          <span>
            <b style={{ color: AGENTS[e.agent].color }}>{AGENTS[e.agent].name}</b> finished in {fmtS(e.ms)}: <span className="text-ink/80">{e.summary}</span>
          </span>
          <span className="ml-auto shrink-0">{time}</span>
        </div>
      );
    case "skip":
      return (
        <div className="fade-in flex items-center gap-2 px-2 py-0.5 text-[11px] text-muted/70">
          <span>⤼</span> {AGENTS[e.agent].name} skipped: {e.reason}
        </div>
      );
    case "hitl_request":
      return (
        <div className="fade-in rounded-lg border border-warn/50 bg-warn/10 p-2 text-[12px] text-warn">⏸ Graph interrupted for human approval: {e.reason}</div>
      );
    case "error":
      return <div className="rounded-lg border border-bad/50 bg-bad/10 p-2 text-[12px] text-bad">{e.message}</div>;
    default:
      return null;
  }
}

// ---------------- Inspector ----------------

const Json = ({ value }: { value: unknown }) => (
  <pre className="scroll-thin max-h-72 overflow-auto rounded-md bg-black/40 p-2 font-mono text-[10.5px] leading-snug text-ink/85">
    {JSON.stringify(value, null, 2)}
  </pre>
);

export function Inspector({ run, id }: { run: RunState; id: NodeId | null }) {
  if (!id) return <p className="p-4 text-sm text-muted">Click any agent in the graph to inspect its prompts, tool calls, messages and output.</p>;
  const meta = AGENTS[id];
  const st = run.nodes[id];
  const msgs = run.events.filter((e): e is Extract<OrchestrationEvent, { type: "message" }> => e.type === "message" && (e.from === id || e.to === id));
  const toolsUsed = run.events.filter((e): e is Extract<OrchestrationEvent, { type: "tool_call" }> => e.type === "tool_call" && e.agent === id);
  const llm = run.events.filter((e): e is Extract<OrchestrationEvent, { type: "llm_call" }> => e.type === "llm_call" && e.agent === id);
  const outputs = run.events.filter((e): e is Extract<OrchestrationEvent, { type: "agent_end" }> => e.type === "agent_end" && e.agent === (id as AgentId));

  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-xl" style={{ background: `${meta.color}22` }}>
          {meta.icon}
        </span>
        <div>
          <div className="font-semibold">{meta.name}</div>
          <div className="text-xs text-muted">
            {meta.role} · <span style={{ color: meta.color }}>{meta.pattern}</span>
          </div>
        </div>
        <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">{st.status}</span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink/80">{meta.description}</p>

      <Section title={`Messages (${msgs.length})`}>
        {msgs.map((m, i) => (
          <div key={i} className="rounded-md border border-line p-2 text-[12px]">
            <div className="mb-1 flex items-center gap-1">
              <AgentChip id={m.from} small /> → <AgentChip id={m.to} small />
            </div>
            {m.content}
          </div>
        ))}
      </Section>

      {toolsUsed.length > 0 && (
        <Section title={`Tool calls (${toolsUsed.length})`}>
          {toolsUsed.map((t, i) => (
            <details key={i} className="rounded-md border border-line p-2">
              <summary className="cursor-pointer font-mono text-[12px] text-accent-2">
                {t.tool}() <span className="text-muted">· {t.ms}ms</span>
              </summary>
              <div className="mt-2 text-[11px] text-muted">args</div>
              <Json value={t.args} />
              <div className="mt-2 text-[11px] text-muted">result</div>
              <Json value={t.result} />
            </details>
          ))}
        </Section>
      )}

      {llm.length > 0 && (
        <Section title={`LLM calls (${llm.length})`}>
          {llm.map((c, i) => (
            <details key={i} className="rounded-md border border-line p-2">
              <summary className="cursor-pointer text-[12px]">
                ✨ {c.model} · {c.promptTokens}+{c.completionTokens} tokens · {fmtS(c.ms)}
              </summary>
              <div className="mt-2 text-[11px] text-muted">system prompt</div>
              <pre className="scroll-thin max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 font-mono text-[10.5px]">{c.system}</pre>
              <div className="mt-2 text-[11px] text-muted">input (state slice this agent can see)</div>
              <pre className="scroll-thin max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 font-mono text-[10.5px]">{c.user}</pre>
              <div className="mt-2 text-[11px] text-muted">response</div>
              <pre className="scroll-thin max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 font-mono text-[10.5px]">{c.response}</pre>
            </details>
          ))}
        </Section>
      )}

      {outputs.length > 0 && (
        <Section title="State update written to the blackboard">
          <Json value={outputs[outputs.length - 1].output} />
        </Section>
      )}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

// ---------------- Compare ----------------

export interface TraditionalResult {
  loading: boolean;
  answer?: string;
  ms?: number;
  tokens?: number;
  error?: string;
}

function groundTruth(run: RunState) {
  const out: Record<string, unknown> = {};
  for (const e of run.events) if (e.type === "agent_end") Object.assign(out, e.output as object);
  const facts: Array<{ fact: string; test: RegExp }> = [];
  const proposal = out.proposal as { decision: string; payout: number } | undefined;
  const coverage = out.coverage as { found: boolean; covered: boolean | null; policy?: { deductible: number; status: string; plan: string } } | undefined;
  const decision = run.final?.decision;
  if (decision === "APPROVE") facts.push({ fact: "Decision: approved", test: /approv/i });
  if (decision === "DENY")
    facts.push({ fact: "Decision: not paid / referred", test: /(den(y|ied)|cannot|can't|unable|not (be )?covered|referred|declin)/i });
  if (proposal && proposal.payout > 0) facts.push({ fact: `Payout $${proposal.payout.toLocaleString()}`, test: new RegExp(proposal.payout.toLocaleString("en-US").replace(",", ",?")) });
  if (coverage?.policy && coverage.policy.deductible > 0)
    facts.push({ fact: `Deductible $${coverage.policy.deductible}`, test: new RegExp(coverage.policy.deductible.toLocaleString("en-US").replace(",", ",?")) });
  if (coverage?.policy?.status === "LAPSED") facts.push({ fact: "Policy has lapsed", test: /(laps|expir)/i });
  if (coverage?.policy?.plan === "THIRD_PARTY_LIABILITY") facts.push({ fact: "Plan is third-party only", test: /third[- ]party|liability/i });
  if (coverage && coverage.covered === false) facts.push({ fact: "Loss is not covered", test: /(not (be )?covered|isn't covered|excluded|exclusion)/i });
  if (proposal?.decision === "HUMAN_REVIEW") facts.push({ fact: "Needs adjuster review", test: /(review|adjuster|investigat|inspect)/i });
  if (run.final?.claimId) facts.push({ fact: `Claim ID ${run.final.claimId}`, test: new RegExp(run.final.claimId) });
  return facts;
}

export function ComparePanel({ run, trad, enabled }: { run: RunState; trad: TraditionalResult | null; enabled: boolean }) {
  const m = computeMetrics(run);
  if (!enabled) return <p className="p-4 text-sm text-muted">Turn on “Compare vs traditional” in the top bar, then send a request.</p>;
  const facts = run.final && trad?.answer ? groundTruth(run) : [];
  const hits = facts.filter((f) => f.test.test(trad?.answer ?? "")).length;

  const rows: Array<[string, string, string]> = [
    ["Architecture", "1 monolithic prompt", `${m.agentsUsed} specialised agents`],
    ["LLM calls", trad?.answer ? "1" : "…", `${m.llmCalls}`],
    ["Tokens", trad?.tokens ? trad.tokens.toLocaleString() : "…", (m.promptTokens + m.completionTokens).toLocaleString()],
    ["Latency", trad?.ms ? fmtS(trad.ms) : "…", fmtS(m.wallMs)],
    ["Access to enterprise data", "None (guesses)", `${m.toolCalls} tool calls`],
    ["Business rules", "Inside prompt (unenforced)", "Deterministic code + LLM"],
    ["Self-review", "None", m.revisions ? `${m.revisions} revision(s)` : "Compliance critic"],
    ["Human-in-the-loop", "Not possible", "Checkpoint + resume"],
    ["Audit trail", "Final text only", `${run.events.length} events`],
  ];

  return (
    <div className="scroll-thin h-full space-y-3 overflow-y-auto p-3 text-sm">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="pb-1 font-medium"></th>
            <th className="pb-1 font-medium">Traditional GenAI</th>
            <th className="pb-1 font-medium text-accent">Agentic</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, a, b]) => (
            <tr key={k} className="border-t border-line/70">
              <td className="py-1 pr-2 text-muted">{k}</td>
              <td className="py-1 pr-2">{a}</td>
              <td className="py-1 font-medium">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {facts.length > 0 && (
        <div className="rounded-lg border border-line p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Fact check (grounded truth from agents)</span>
            <span className={`font-mono text-xs ${hits === facts.length ? "text-ok" : "text-bad"}`}>
              {hits}/{facts.length}
            </span>
          </div>
          {facts.map((f) => {
            const ok = f.test.test(trad?.answer ?? "");
            return (
              <div key={f.fact} className="flex items-center gap-2 text-[12px]">
                <span className={ok ? "text-ok" : "text-bad"}>{ok ? "✓" : "✗"}</span>
                {f.fact}
              </div>
            );
          })}
          <p className="mt-1.5 text-[10.5px] text-muted">Naive keyword match: does the traditional reply contain each verified fact?</p>
        </div>
      )}

      <div className="rounded-lg border border-line p-2.5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Traditional GenAI reply</div>
        {trad?.loading && <p className="text-muted">Generating…</p>}
        {trad?.error && <p className="text-bad">{trad.error}</p>}
        {trad?.answer && <Markdown>{trad.answer}</Markdown>}
      </div>
      <div className="rounded-lg border border-accent/50 p-2.5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">Agentic orchestration reply</div>
        {run.final ? <Markdown>{run.final.answer}</Markdown> : <p className="text-muted">{run.status === "waiting" ? "Awaiting adjuster…" : "Orchestrating…"}</p>}
      </div>
    </div>
  );
}

// ---------------- HITL ----------------

export function HitlCard({ run, onDecide }: { run: RunState; onDecide: (approved: boolean, note: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!run.hitl) return null;
  const s = run.hitl.summary as { claimId?: string; claimant?: string; payout?: number; fraudScore?: number; estimate?: number; rationale?: string };
  const decide = (ok: boolean) => {
    setBusy(true);
    onDecide(ok, note);
  };
  return (
    <div className="fade-in rounded-xl border border-warn/60 bg-[#1d1a0f] p-3 shadow-2xl">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-warn">🧑‍💼 Adjuster approval required · {s.claimId}</div>
      <div className="mb-2 text-[12px] text-ink/80">{run.hitl.reason}</div>
      <div className="mb-2 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-md bg-black/30 p-1.5">
          <div className="text-muted">Estimate</div>
          <div className="font-mono text-sm">${s.estimate?.toLocaleString()}</div>
        </div>
        <div className="rounded-md bg-black/30 p-1.5">
          <div className="text-muted">Proposed payout</div>
          <div className="font-mono text-sm">${s.payout?.toLocaleString()}</div>
        </div>
        <div className="rounded-md bg-black/30 p-1.5">
          <div className="text-muted">Fraud risk</div>
          <div className="font-mono text-sm text-bad">{s.fraudScore}/100</div>
        </div>
      </div>
      {s.rationale && <p className="mb-2 line-clamp-2 text-[11.5px] italic text-muted" title={s.rationale}>“{s.rationale}”</p>}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Adjuster note (optional), e.g. Schedule physical inspection"
        className="mb-2 w-full rounded-md border border-line bg-black/30 px-2 py-1.5 text-[12px] outline-none focus:border-warn"
      />
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide(true)} className="flex-1 rounded-md bg-ok/90 py-1.5 text-sm font-semibold text-black hover:bg-ok disabled:opacity-50">
          Approve payout
        </button>
        <button disabled={busy} onClick={() => decide(false)} className="flex-1 rounded-md bg-bad/90 py-1.5 text-sm font-semibold text-black hover:bg-bad disabled:opacity-50">
          Reject → SIU
        </button>
      </div>
    </div>
  );
}
