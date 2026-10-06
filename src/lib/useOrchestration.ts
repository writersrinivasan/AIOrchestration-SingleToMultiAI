"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AGENTS, type AgentId, type Decision, type NodeId, type OrchestrationEvent } from "./agents";

export type NodeStatus = "idle" | "running" | "done" | "skipped" | "waiting" | "error";
export type EdgeStatus = "idle" | "active" | "done";

export interface NodeState {
  status: NodeStatus;
  summary?: string;
  ms?: number;
  narration?: string;
  runs: number;
}

export interface RunState {
  status: "idle" | "running" | "waiting" | "done" | "error";
  threadId?: string;
  query?: string;
  nodes: Record<NodeId, NodeState>;
  edges: Record<string, EdgeStatus>;
  edgeLabels: Record<string, string>;
  events: OrchestrationEvent[];
  narration: string;
  hitl?: Extract<OrchestrationEvent, { type: "hitl_request" }>;
  final?: { answer: string; decision: Decision | null; claimId: string | null };
  error?: string;
  // Active (non-paused) wall-clock time across the initial run and any resumed run.
  activeMs: number;
  segmentStart?: number;
}

const freshNodes = () =>
  Object.fromEntries((Object.keys(AGENTS) as NodeId[]).map((id) => [id, { status: "idle", runs: 0 } as NodeState])) as Record<
    NodeId,
    NodeState
  >;

export const initialRun = (): RunState => ({
  status: "idle",
  nodes: freshNodes(),
  edges: {},
  edgeLabels: {},
  events: [],
  narration: "Pick a scenario or type a request. Watch the agents plan, delegate, call tools, and negotiate a decision.",
  activeMs: 0,
});

type Action = { kind: "reset" } | { kind: "event"; e: OrchestrationEvent };

const ekey = (from: NodeId, to: NodeId) => `${from}->${to}`;

function reduce(state: RunState, action: Action): RunState {
  if (action.kind === "reset") return initialRun();
  const e = action.e;
  const s: RunState = { ...state, events: [...state.events, e] };
  const setNode = (id: NodeId, patch: Partial<NodeState>) => {
    s.nodes = { ...s.nodes, [id]: { ...s.nodes[id], ...patch } };
  };
  // An edge stops being "active" once its target agent starts working.
  const settleEdgesInto = (to: NodeId) => {
    const edges = { ...s.edges };
    for (const k of Object.keys(edges)) if (k.endsWith(`->${to}`) && edges[k] === "active") edges[k] = "done";
    s.edges = edges;
  };

  switch (e.type) {
    case "run_start":
      s.status = "running";
      s.threadId = e.threadId;
      s.segmentStart = e.ts;
      if (!e.resumed) {
        s.query = e.query;
        setNode("user", { status: "done", summary: "Request sent" });
      } else {
        s.hitl = undefined;
        s.narration = "Adjuster decision received. Resuming the graph from its checkpoint.";
      }
      break;
    case "message":
      s.edges = { ...s.edges, [ekey(e.from, e.to)]: "active" };
      s.edgeLabels = { ...s.edgeLabels, [ekey(e.from, e.to)]: e.content };
      if (e.to === "response") {
        setNode("response", { status: "done", summary: "Delivered" });
        s.edges = { ...s.edges, [ekey(e.from, e.to)]: "done" };
      }
      break;
    case "agent_start":
      settleEdgesInto(e.agent);
      setNode(e.agent, {
        status: e.agent === "human" ? "waiting" : "running",
        narration: e.narration,
        // A node resumed after interrupt() re-executes; that is not a new run.
        runs: s.nodes[e.agent].runs + (s.nodes[e.agent].status === "waiting" ? 0 : 1),
      });
      s.narration = e.narration;
      break;
    case "agent_end":
      setNode(e.agent, { status: "done", summary: e.summary, ms: e.ms });
      break;
    case "skip":
      if (s.nodes[e.agent].status === "idle") setNode(e.agent, { status: "skipped", summary: e.reason });
      break;
    case "hitl_request":
      s.status = "waiting";
      s.hitl = e;
      s.narration = "⏸ Human-in-the-loop: state is checkpointed. The graph resumes when the adjuster decides.";
      if (s.segmentStart) s.activeMs += e.ts - s.segmentStart;
      s.segmentStart = undefined;
      break;
    case "final": {
      s.status = "done";
      s.final = { answer: e.answer, decision: e.decision, claimId: e.claimId };
      s.narration = "✅ Done. Every hop, tool call and LLM call above is recorded and auditable.";
      if (s.segmentStart) s.activeMs += e.ts - s.segmentStart;
      s.segmentStart = undefined;
      const nodes = { ...s.nodes };
      for (const id of Object.keys(nodes) as NodeId[])
        if (nodes[id].status === "idle") nodes[id] = { ...nodes[id], status: "skipped", summary: "Not needed for this request" };
      s.nodes = nodes;
      const edges = { ...s.edges };
      for (const k of Object.keys(edges)) if (edges[k] === "active") edges[k] = "done";
      s.edges = edges;
      break;
    }
    case "error":
      s.status = "error";
      s.error = e.message;
      s.narration = `❌ ${e.message}`;
      for (const id of Object.keys(s.nodes) as NodeId[])
        if (s.nodes[id].status === "running") setNode(id, { status: "error" });
      break;
  }
  return s;
}

export interface Metrics {
  agentsUsed: number;
  llmCalls: number;
  toolCalls: number;
  promptTokens: number;
  completionTokens: number;
  messages: number;
  wallMs: number;
  sequentialMs: number;
  revisions: number;
}

export function computeMetrics(run: RunState): Metrics {
  const agents = new Set<AgentId>();
  let llmCalls = 0,
    toolCalls = 0,
    promptTokens = 0,
    completionTokens = 0,
    messages = 0,
    sequentialMs = 0,
    settlementRuns = 0;
  for (const e of run.events) {
    if (e.type === "agent_end" && e.agent !== "human") {
      agents.add(e.agent);
      sequentialMs += e.ms;
      if (e.agent === "settlement") settlementRuns++;
    }
    if (e.type === "agent_end" && e.agent === "human") agents.add("human");
    if (e.type === "llm_call") {
      llmCalls++;
      promptTokens += e.promptTokens;
      completionTokens += e.completionTokens;
    }
    if (e.type === "tool_call") toolCalls++;
    if (e.type === "message") messages++;
  }
  const live = run.segmentStart ? Date.now() - run.segmentStart : 0;
  return {
    agentsUsed: agents.size,
    llmCalls,
    toolCalls,
    promptTokens,
    completionTokens,
    messages,
    wallMs: run.activeMs + live,
    sequentialMs,
    revisions: Math.max(0, settlementRuns - 1),
  };
}

async function readNDJSON(res: Response, onEvent: (e: OrchestrationEvent) => void) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

export function useOrchestration() {
  const [run, dispatch] = useReducer(reduce, undefined, initialRun);
  const replayTimers = useRef<number[]>([]);
  const [replaying, setReplaying] = useState(false);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  const stopReplay = () => {
    replayTimers.current.forEach((t) => window.clearTimeout(t));
    replayTimers.current = [];
    setReplaying(false);
  };

  const start = useCallback(async (query: string, model: string) => {
    stopReplay();
    dispatch({ kind: "reset" });
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, model }),
      });
      await readNDJSON(res, (e) => dispatch({ kind: "event", e }));
    } catch (err) {
      dispatch({ kind: "event", e: { type: "error", ts: Date.now(), message: String(err) } });
    }
  }, []);

  const resume = useCallback(async (approved: boolean, note: string, model: string) => {
    const threadId = runRef.current.threadId;
    if (!threadId || replayTimers.current.length) return;
    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, model, resume: { approved, note } }),
      });
      await readNDJSON(res, (e) => dispatch({ kind: "event", e }));
    } catch (err) {
      dispatch({ kind: "event", e: { type: "error", ts: Date.now(), message: String(err) } });
    }
  }, []);

  // Replays the recorded event stream with its original timing (long pauses compressed).
  const replay = useCallback((speed = 1) => {
    const events = runRef.current.events;
    if (!events.length) return;
    stopReplay();
    dispatch({ kind: "reset" });
    let t = 0;
    let prev = events[0].ts;
    for (const e of events) {
      const gap = Math.min(e.ts - prev, 1500);
      prev = e.ts;
      t += Math.max(gap, e.type === "message" ? 120 : 0) / speed;
      replayTimers.current.push(window.setTimeout(() => dispatch({ kind: "event", e }), t));
    }
    setReplaying(true);
    replayTimers.current.push(window.setTimeout(stopReplay, t + 50));
  }, []);

  const reset = useCallback(() => {
    stopReplay();
    dispatch({ kind: "reset" });
  }, []);

  return { run, start, resume, replay, reset, replaying };
}
