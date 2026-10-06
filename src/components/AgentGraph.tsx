"use client";

import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { AGENTS, type NodeId } from "@/lib/agents";
import type { EdgeStatus, NodeState, RunState } from "@/lib/useOrchestration";

// ---------- Layout ----------

const POS: Record<NodeId, { x: number; y: number }> = {
  user: { x: 0, y: 205 },
  orchestrator: { x: 165, y: 200 },
  intake: { x: 350, y: 200 },
  policy: { x: 560, y: 30 },
  fraud: { x: 560, y: 200 },
  damage: { x: 560, y: 370 },
  settlement: { x: 770, y: 200 },
  reviewer: { x: 970, y: 200 },
  human: { x: 970, y: 400 },
  comms: { x: 1170, y: 200 },
  response: { x: 1375, y: 205 },
};

type Route = { sh: string; th: string; kind: "bezier" | "step" | "lane"; lane?: number };

// Handle ids: l = left target, r = right source, tt/ts = top target/source, bt/bs = bottom target/source.
const ROUTES: Record<string, Route> = {
  "orchestrator->comms": { sh: "bs", th: "bt", kind: "lane", lane: 590 },
  "intake->comms": { sh: "bs", th: "bt", kind: "lane", lane: 560 },
  "fraud->comms": { sh: "bs", th: "bt", kind: "lane", lane: 530 },
  "damage->comms": { sh: "bs", th: "bt", kind: "lane", lane: 530 },
  "policy->comms": { sh: "ts", th: "tt", kind: "lane", lane: -20 },
  "reviewer->settlement": { sh: "ts", th: "tt", kind: "lane", lane: 150 },
  "reviewer->human": { sh: "bs", th: "tt", kind: "step" },
  "human->comms": { sh: "r", th: "bt", kind: "step" },
};

// ---------- Node ----------

type AgentNodeData = { id: NodeId; state: NodeState; selected: boolean };

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const meta = AGENTS[data.id];
  const st = data.state;
  const io = data.id === "user" || data.id === "response";
  const statusLabel: Record<string, string> = {
    idle: "idle",
    running: "working",
    done: "done",
    skipped: "skipped",
    waiting: "awaiting human",
    error: "error",
  };
  const pill: Record<string, string> = {
    idle: "bg-white/5 text-muted",
    running: "bg-accent/30 text-white",
    done: "bg-ok/20 text-ok",
    skipped: "bg-white/5 text-muted",
    waiting: "bg-warn/20 text-warn",
    error: "bg-bad/20 text-bad",
  };

  return (
    <div
      className={`relative ${io ? "w-[132px]" : "w-[172px]"} rounded-xl border bg-panel px-3 py-2.5 text-left transition-all duration-300 ${
        st.status === "running" || st.status === "waiting" ? "node-running" : ""
      } ${st.status === "skipped" ? "opacity-35 border-dashed" : ""} ${data.selected ? "ring-2 ring-white/70" : ""}`}
      style={
        {
          borderColor: st.status === "idle" || st.status === "skipped" ? "var(--border)" : meta.color,
          boxShadow: st.status === "done" ? `0 0 18px -6px ${meta.color}` : undefined,
          ["--glow" as string]: `${meta.color}99`,
        } as React.CSSProperties
      }
    >
      {(["l", "tt", "bt"] as const).map((id) => (
        <Handle key={id} id={id} type="target" position={id === "l" ? Position.Left : id === "tt" ? Position.Top : Position.Bottom} />
      ))}
      {(["r", "ts", "bs"] as const).map((id) => (
        <Handle key={id} id={id} type="source" position={id === "r" ? Position.Right : id === "ts" ? Position.Top : Position.Bottom} />
      ))}

      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base" style={{ background: `${meta.color}22` }}>
          {meta.icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">{meta.name}</div>
          {!io && <div className="truncate text-[11px] text-muted">{meta.role}</div>}
        </div>
      </div>

      {!io && (
        <div className="mt-2 flex items-center justify-between gap-1">
          <span className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${pill[st.status]}`}>
            {st.status === "running" && <span className="spin inline-block h-2.5 w-2.5 rounded-full border border-white/40 border-t-white" />}
            {st.status === "done" && "✓"}
            {statusLabel[st.status]}
            {st.runs > 1 && ` ×${st.runs}`}
          </span>
          {st.ms !== undefined && st.status === "done" && <span className="font-mono text-[10px] text-muted">{(st.ms / 1000).toFixed(2)}s</span>}
        </div>
      )}

      {st.summary && st.status !== "idle" && (
        <div className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-ink/85 fade-in">{st.summary}</div>
      )}

      {meta.tools.length > 0 && st.status !== "skipped" && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {meta.tools.map((t) => (
            <span key={t} className="rounded bg-white/5 px-1 font-mono text-[9px] text-muted">
              ⚙ {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Edge ----------

type FlowEdgeData = { status: EdgeStatus; color: string; route?: Route; label?: string; bypass: boolean };

function lanePath(sx: number, sy: number, tx: number, ty: number, lane: number) {
  const r = 12;
  const dir1 = lane > sy ? 1 : -1;
  const dir2 = ty > lane ? 1 : -1;
  const hx = tx > sx ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${sx} ${lane - dir1 * r}`,
    `Q ${sx} ${lane} ${sx + hx * r} ${lane}`,
    `L ${tx - hx * r} ${lane}`,
    `Q ${tx} ${lane} ${tx} ${lane + dir2 * r}`,
    `L ${tx} ${ty}`,
  ].join(" ");
}

function FlowEdge(props: EdgeProps<Edge<FlowEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const route = data?.route;
  let path: string;
  let lx: number;
  let ly: number;
  if (route?.kind === "lane") {
    path = lanePath(sourceX, sourceY, targetX, targetY, route.lane!);
    lx = (sourceX + targetX) / 2;
    ly = route.lane!;
  } else if (route?.kind === "step") {
    [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12 });
  } else {
    [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  }

  const status = data?.status ?? "idle";
  const color = data?.color ?? "#64748b";
  const stroke = status === "idle" ? "#3a4470" : color;
  const opacity = status === "idle" ? (data?.bypass ? 0.18 : 0.55) : 1;

  return (
    <>
      <BaseEdge
        path={path}
        style={{
          stroke,
          strokeWidth: status === "active" ? 2.6 : status === "done" ? 2 : 1.3,
          opacity,
          strokeDasharray: status === "active" ? "6 5" : data?.bypass && status === "idle" ? "4 6" : undefined,
          animation: status === "active" ? "dash 0.6s linear infinite" : undefined,
          transition: "stroke 0.3s, opacity 0.3s",
        }}
      />
      {status === "active" && (
        <>
          <circle r={5} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
            <animateMotion dur="1.1s" repeatCount="indefinite" path={path} />
          </circle>
          {data?.label && (
            <EdgeLabelRenderer>
              <div
                className="nodrag nopan pointer-events-none absolute max-w-[190px] rounded-md border px-1.5 py-0.5 text-[9.5px] leading-tight text-white shadow-lg fade-in"
                style={{
                  transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
                  background: "#0b1020ee",
                  borderColor: color,
                }}
              >
                {data.label.length > 70 ? data.label.slice(0, 70) + "…" : data.label}
              </div>
            </EdgeLabelRenderer>
          )}
        </>
      )}
    </>
  );
}

const nodeTypes = { agent: AgentNode };
const edgeTypes = { flow: FlowEdge };

// ---------- Graph ----------

export function AgentGraph({
  run,
  edges: edgeList,
  selected,
  onSelect,
}: {
  run: RunState;
  edges: Array<[NodeId, NodeId]>;
  selected: NodeId | null;
  onSelect: (id: NodeId) => void;
}) {
  const nodes: Node<AgentNodeData>[] = useMemo(
    () =>
      (Object.keys(POS) as NodeId[]).map((id) => ({
        id,
        type: "agent",
        position: POS[id],
        data: { id, state: run.nodes[id], selected: selected === id },
        draggable: true,
      })),
    [run.nodes, selected],
  );

  const edges: Edge<FlowEdgeData>[] = useMemo(
    () =>
      edgeList.map(([from, to]) => {
        const key = `${from}->${to}`;
        const route = ROUTES[key];
        return {
          id: key,
          source: from,
          target: to,
          sourceHandle: route?.sh ?? "r",
          targetHandle: route?.th ?? "l",
          type: "flow",
          data: {
            status: run.edges[key] ?? "idle",
            color: AGENTS[from].color,
            route,
            label: run.edgeLabels[key],
            bypass: Boolean(route && route.kind === "lane"),
          },
        };
      }),
    [edgeList, run.edges, run.edgeLabels],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, n) => onSelect(n.id as NodeId)}
      fitView
      fitViewOptions={{ padding: 0.04 }}
      minZoom={0.3}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
    >
      <Background color="#26305a" gap={22} size={1} />
      <Controls showInteractive={false} position="bottom-right" />
      <style>{`@keyframes dash { to { stroke-dashoffset: -22; } }`}</style>
    </ReactFlow>
  );
}
