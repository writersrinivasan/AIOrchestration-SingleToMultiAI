"use client";

import { useEffect, useRef, useState } from "react";
import { AgentGraph } from "@/components/AgentGraph";
import { ComparePanel, HitlCard, Inspector, Markdown, MessageBus, MetricsBar, type TraditionalResult } from "@/components/StudioPanels";
import { EDGES, SAMPLE_PROMPTS, type Decision, type NodeId } from "@/lib/agents";
import { useOrchestration } from "@/lib/useOrchestration";

interface Turn {
  query: string;
  answer?: string;
  decision?: Decision | null;
  claimId?: string | null;
  error?: string;
}

const DECISION_STYLE: Record<Decision, string> = {
  APPROVE: "bg-ok/20 text-ok border-ok/50",
  HUMAN_REVIEW: "bg-warn/20 text-warn border-warn/50",
  DENY: "bg-bad/20 text-bad border-bad/50",
};

export default function StudioPage() {
  const { run, start, resume, replay, replaying } = useOrchestration();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [tab, setTab] = useState<"bus" | "inspect" | "compare">("bus");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [mock, setMock] = useState(false);
  const [compare, setCompare] = useState(true);
  const [trad, setTrad] = useState<TraditionalResult | null>(null);
  const [focus, setFocus] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, tick] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models);
        setModel(d.default);
        setMock(Boolean(d.mock));
      })
      .catch(() => {});
  }, []);

  // Re-render the live wall-clock metric while running.
  useEffect(() => {
    if (run.status !== "running") return;
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [run.status]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [history.length, run.query, run.final, run.error, run.hitl]);

  const busy = run.status === "running" || replaying;
  const turns: Turn[] = run.query
    ? [...history, { query: run.query, answer: run.final?.answer, decision: run.final?.decision, claimId: run.final?.claimId, error: run.error }]
    : history;

  const send = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setSelected(null);
    if (run.query) {
      const prev = { query: run.query, answer: run.final?.answer, decision: run.final?.decision, claimId: run.final?.claimId, error: run.error };
      setHistory((h) => [...h, prev]);
    }
    start(q, model);
    if (compare) {
      setTrad({ loading: true });
      fetch("/api/traditional", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, model }) })
        .then((r) => r.json())
        .then((d) => setTrad(d.error ? { loading: false, error: d.error } : { loading: false, ...d }))
        .catch((e) => setTrad({ loading: false, error: String(e) }));
    } else setTrad(null);
  };

  const select = (id: NodeId) => {
    setSelected(id);
    setTab("inspect");
  };

  return (
    <main className="flex h-[calc(100vh-3.5rem)] flex-col gap-2 p-2">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className={`rounded-full border px-2 py-0.5 font-medium ${mock ? "border-warn/60 text-warn" : "border-ok/60 text-ok"}`}>
          {mock ? "● Simulation mode (no GROQ_API_KEY)" : "● Live · Groq"}
        </span>
        <span className="text-muted">Framework: <b className="text-ink">LangGraph.js</b> StateGraph</span>
        <label className="flex items-center gap-1 text-muted">
          Model
          <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-md border border-line bg-panel px-1.5 py-1 text-ink">
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-muted">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="accent-[var(--accent)]" />
          Compare vs traditional GenAI
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-md border border-line bg-panel px-1.5 py-1">
            {[0.25, 0.5, 1, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
          <button
            onClick={() => replay(speed)}
            disabled={busy || !run.events.length}
            className="rounded-md border border-line px-2.5 py-1 hover:border-accent disabled:opacity-40"
            title="Replay the recorded run (no new LLM calls)"
          >
            ⟲ Replay
          </button>
          <button onClick={() => setFocus((f) => !f)} className="rounded-md border border-line px-2.5 py-1 hover:border-accent">
            {focus ? "Show panels" : "⛶ Focus graph"}
          </button>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 gap-2 ${focus ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[1fr_400px]"}`}>
        {/* Left: graph-centric column */}
        <section className="flex min-h-0 flex-col gap-2">
          <div className="card flex items-center gap-3 px-3 py-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${busy ? "bg-accent node-running" : run.status === "waiting" ? "bg-warn" : run.status === "done" ? "bg-ok" : run.status === "error" ? "bg-bad" : "bg-muted"}`}
              style={{ ["--glow" as string]: "#7c5cffaa" }}
            />
            <p className="text-[14px] leading-snug">{run.narration}</p>
          </div>

          <div className="card relative min-h-[360px] flex-1 overflow-hidden">
            <AgentGraph key={focus ? "focus" : "normal"} run={run} edges={EDGES} selected={selected} onSelect={select} />
            <div className="pointer-events-none absolute left-3 top-2 flex flex-wrap gap-3 text-[11px] text-muted">
              <span>● working</span>
              <span className="text-ok">✓ done</span>
              <span className="opacity-60">┄ skipped / bypass route</span>
              <span>━● message in flight</span>
              <span className="opacity-80">click an agent to inspect it</span>
            </div>
            {run.hitl && !replaying && (
              <div className="absolute bottom-3 left-3 z-10 w-[400px] max-w-[calc(100%-1.5rem)]">
                <HitlCard key={run.threadId} run={run} onDecide={(ok, note) => resume(ok, note, model)} />
              </div>
            )}
          </div>

          <MetricsBar run={run} />

          {/* Chat (customer view) */}
          {!focus && (
            <section className="card grid h-[250px] shrink-0 grid-cols-1 overflow-hidden md:grid-cols-[1fr_300px]">
              <div className="flex min-h-0 flex-col">
                <div className="border-b border-line px-3 py-1.5 text-[12.5px] font-semibold">
                  Apex Mutual · Claims Assistant <span className="font-normal text-muted">(customer channel)</span>
                </div>
                <div className="scroll-thin flex-1 space-y-2 overflow-y-auto p-3">
                  {!turns.length && <p className="text-[12.5px] text-muted">Pick a scenario on the right, or describe an incident below.</p>}
                  {turns.map((t, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-tr-sm bg-accent/25 px-2.5 py-1.5 text-[13px]">{t.query}</div>
                      {t.answer && (
                        <div className="max-w-[92%] rounded-xl rounded-tl-sm border border-line bg-panel-2/60 px-2.5 py-1.5">
                          {t.decision && (
                            <span className={`mb-1 inline-block rounded border px-1.5 text-[10px] font-semibold ${DECISION_STYLE[t.decision]}`}>
                              {t.decision.replace("_", " ")}
                            </span>
                          )}
                          <Markdown>{t.answer}</Markdown>
                        </div>
                      )}
                      {t.error && <div className="rounded-lg border border-bad/50 bg-bad/10 p-2 text-[12px] text-bad">{t.error}</div>}
                      {i === turns.length - 1 && !t.answer && !t.error && (
                        <div className="text-[12px] text-muted">{run.status === "waiting" ? "⏸ Waiting for adjuster approval (see the graph)…" : "Agents are working…"}</div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex gap-2 border-t border-line p-2"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe an incident or ask about coverage…"
                    className="flex-1 rounded-lg border border-line bg-black/20 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
                  />
                  <button disabled={busy || !input.trim()} className="rounded-lg bg-accent px-4 text-sm font-semibold disabled:opacity-40">
                    Send
                  </button>
                </form>
              </div>
              <div className="scroll-thin hidden space-y-1 overflow-y-auto border-l border-line p-2 md:block">
                <div className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Demo scenarios</div>
                {SAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    disabled={busy}
                    onClick={() => send(p.text)}
                    title={p.text}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-panel-2/40 px-2 py-1 text-left text-[12px] hover:border-accent disabled:opacity-40"
                  >
                    <span className="truncate">{p.label}</span>
                    <span className="shrink-0 rounded bg-accent/20 px-1 text-[9.5px] text-accent">{p.tag}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>

        {/* Right panel */}
        {!focus && (
          <section className="card flex min-h-[400px] flex-col">
            <div className="flex border-b border-line text-[12.5px]">
              {(
                [
                  ["bus", "Message Bus"],
                  ["inspect", "Inspector"],
                  ["compare", "Compare"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-2 ${tab === k ? "border-b-2 border-accent text-white" : "text-muted hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {tab === "bus" && <MessageBus run={run} onSelect={select} />}
              {tab === "inspect" && <Inspector run={run} id={selected} />}
              {tab === "compare" && <ComparePanel run={run} trad={trad} enabled={compare} />}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
