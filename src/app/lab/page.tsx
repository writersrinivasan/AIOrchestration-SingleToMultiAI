import Link from "next/link";

type Lab = {
  id: string;
  title: string;
  mins: number;
  goal: string;
  steps: React.ReactNode[];
  expect: string;
  solution?: React.ReactNode;
  live?: boolean;
};

const Code = ({ children }: { children: string }) => (
  <pre className="scroll-thin my-2 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-ink/90">{children}</pre>
);
const F = ({ children }: { children: string }) => <code className="rounded bg-white/5 px-1 font-mono text-[12.5px] text-accent-2">{children}</code>;

const LABS: Lab[] = [
  {
    id: "lab0",
    title: "Setup",
    mins: 5,
    goal: "Get the app running locally with your own Groq key.",
    steps: [
      <>Install Node.js 20+ and open the project folder.</>,
      <>
        Create a free API key at <b>console.groq.com</b> → API Keys.
      </>,
      <>
        Run:
        <Code>{`npm install
cp .env.example .env.local      # then paste your key into GROQ_API_KEY
npm run dev                      # open http://localhost:3000/studio`}</Code>
      </>,
      <>
        The top bar should show <b className="text-ok">● Live · Groq</b>. With no key, the app falls back to <b className="text-warn">Simulation mode</b>:
        the graph, tools, routing and HITL are real, but the LLM is replaced by rules.
      </>,
    ],
    expect: "Studio loads, the model dropdown lists Groq models, and a sample scenario runs end to end.",
  },
  {
    id: "lab1",
    title: "Observe & trace the orchestration",
    mins: 10,
    goal: "Learn to read a multi-agent run: who talked to whom, with what, and why.",
    steps: [
      <>Run the <b>Clean claim → auto-approve</b> scenario. Watch the three specialists light up at the same time.</>,
      <>
        Open the <b>Message Bus</b> and turn on <i>LLM calls</i>. Count the LLM calls and the tool calls.
      </>,
      <>
        Click the <b>Policy Agent</b> → Inspector → expand <F>checkCoverageRules()</F>. Which rules passed?
      </>,
      <>
        Look at <b>Parallelism saved</b> in the metrics bar. Why is <i>Σ agent time</i> greater than <i>wall time</i>?
      </>,
      <>
        Run <b>Lapsed policy → deny</b>. Which tool call, and which <i>rule</i>, decided the outcome? Did the LLM decide it?
      </>,
      <>
        Run <b>Coverage question only</b>. How many agents were skipped? What does that mean for cost?
      </>,
    ],
    expect: "You can explain each hop of a run using only the trace, which is the same evidence an auditor would ask for.",
    solution: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Happy path: 8 LLM calls (orchestrator, intake, policy, fraud, damage, settlement, reviewer, comms) and 8 tool calls.</li>
        <li>Σ agent time &gt; wall time because Policy, Fraud and Damage ran concurrently in one LangGraph superstep.</li>
        <li>
          Lapsed: <F>checkCoverageRules()</F> → “Policy status is ACTIVE” = false. The code guardrail{" "}
          <F>rules.covered === false ? false : …</F> means the LLM <i>cannot</i> override it.
        </li>
        <li>Coverage question: Fraud, Damage, Settlement, Reviewer and Human are skipped. That&apos;s 4 LLM calls instead of 8, roughly half the cost and latency.</li>
      </ul>
    ),
  },
  {
    id: "lab2",
    title: "Change a business rule, not a prompt",
    mins: 5,
    goal: "See why rules belong in deterministic tools, and how one change re-routes the whole graph.",
    steps: [
      <>
        Open <F>src/lib/orchestrator/tools.ts</F> and find <F>STP_PAYOUT_LIMIT</F> (the straight-through-processing authority limit).
      </>,
      <>
        Change it from <F>15000</F> to <F>500</F> and save. Next.js hot-reloads the server.
      </>,
      <>
        Re-run <b>Clean claim → auto-approve</b>. The $717 payout now exceeds the limit.
      </>,
      <>Approve it as the Human Adjuster, then set the limit back to 15000.</>,
    ],
    expect: "Priya's claim now pauses at the Human Adjuster. The Reviewer prompt picks up the new limit automatically because it is interpolated from the same constant.",
    solution: (
      <p>
        One line of code moved a claim from straight-through processing to human review: no prompt edits, no retesting of other agents. Point out that the
        Reviewer prompt reads <F>{"${tools.STP_PAYOUT_LIMIT}"}</F>. Keeping prompts and code in sync is a real production concern.
      </p>
    ),
  },
  {
    id: "lab3",
    title: "Trigger the reflection loop",
    mins: 7,
    live: true,
    goal: "Make the critic stricter and watch agents negotiate: Reviewer rejects, Settlement revises.",
    steps: [
      <>
        Open <F>src/lib/orchestrator/graph.ts</F> → the <b>Compliance Reviewer</b> system prompt.
      </>,
      <>
        Add a rule after rule 5:
        <Code>{`6. The rationale MUST quote the claim ID (e.g. CLM-2026-1234) and the exact deductible amount.`}</Code>
      </>,
      <>
        Run the happy-path scenario. In the graph, look for the <b>reviewer → settlement</b> back-edge and the <b>×2</b> badge on Settlement.
      </>,
      <>
        In the Inspector for Settlement, open the 2nd LLM call. Find the reviewer&apos;s feedback injected into the prompt.
      </>,
    ],
    expect: "Revisions = 1 in the metrics bar. The second rationale addresses the feedback, and the loop stops because MAX_REVISIONS = 1.",
    solution: (
      <p>
        If the first draft already satisfies the rule, the loop won&apos;t fire. Make the rule stricter (e.g. require a bullet list). Discuss: why cap the loop? (cost,
        latency, and critics that never converge). Where else would you put a critic? (Intake, before expensive downstream work.)
      </p>
    ),
  },
  {
    id: "lab4",
    title: "Add a new agent: Subrogation (cost recovery)",
    mins: 20,
    goal: "Extend the team with a 4th parallel specialist that decides whether a third party is liable, so the insurer can recover its payout.",
    steps: [
      <>
        <b>Register the agent</b> in <F>src/lib/agents.ts</F>: add <F>{`"subrogation"`}</F> to <F>AgentId</F> and <F>Specialist</F>, add an{" "}
        <F>AGENTS.subrogation</F> entry (name, icon, colour), append it to <F>SPECIALISTS</F>, and add edges:
        <Code>{`["intake", "subrogation"],
["subrogation", "settlement"],`}</Code>
      </>,
      <>
        <b>Place it on the canvas</b> in <F>src/components/AgentGraph.tsx</F>:
        <Code>{`subrogation: { x: 560, y: -150 },`}</Code>
      </>,
      <>
        <b>Add a state channel</b> in <F>ClaimState</F> (<F>graph.ts</F>). Note that a channel can&apos;t share a node&apos;s name:
        <Code>{`subro: last<{ thirdPartyAtFault: boolean; faultPercent: number; rationale: string } | null>(null),`}</Code>
      </>,
      <>
        <b>Write the agent</b>:
        <Code>{`const subrogation = agent(
  "subrogation",
  () => "Subrogation Agent checks whether a third party is liable, so the insurer can recover its costs.",
  async (s) => {
    const llm = await callJSON<{ third_party_at_fault: boolean; fault_percent: number; rationale: string }>({
      agent: "subrogation", model, emit,
      system: \`You are the Subrogation Agent. From the incident narrative, decide whether another identifiable party caused the loss
(being rear-ended = other driver at fault; hitting a pole or wall = insured at fault; vandalism by an unknown person = no recoverable party).
Return JSON: {"third_party_at_fault": boolean, "fault_percent": number, "rationale": string}\`,
      user: JSON.stringify({ narrative: s.query, fnol: s.fnol }),
    });
    const subro = { thirdPartyAtFault: Boolean(llm.third_party_at_fault), faultPercent: Number(llm.fault_percent) || 0, rationale: llm.rationale };
    return { update: { subro }, summary: subro.thirdPartyAtFault ? \`Recover \${subro.faultPercent}% from third party\` : "No recovery opportunity" };
  },
);`}</Code>
      </>,
      <>
        <b>Wire it into the graph</b>: <F>{`.addNode("subrogation", subrogation)`}</F>, add <F>{`"subrogation"`}</F> to the intake router&apos;s destinations, and add{" "}
        <F>{`.addConditionalEdges("subrogation", fromSpecialist("subrogation"), ["settlement", "comms"])`}</F>. Then run <F>npx tsc --noEmit</F>: the
        compiler points to the <F>brief</F> / <F>msg</F> records that need a <F>subrogation</F> entry. Typed state catches missing wiring.
      </>,
      <>
        Tell the <b>Orchestrator</b> the specialist exists (its system prompt lists the specialists).
      </>,
      <>
        Run the happy path (rear-ended → other driver at fault), then Marcus (hit a pole → no recovery).
      </>,
    ],
    expect: "Four specialists fan out in parallel, and Settlement still runs once (fan-in). The new agent's message appears on the bus. No other agent's code changed.",
    solution: (
      <div className="space-y-2">
        <p>
          Full, tested solution: <F>labs/solutions/lab4-subrogation.patch</F>. Apply it with:
        </p>
        <Code>{`git apply labs/solutions/lab4-subrogation.patch`}</Code>
        <p>
          Stretch goal: pass <F>s.subro</F> into the Comms Agent facts so the customer is told “we will recover your deductible from the other party’s insurer”.
        </p>
      </div>
    ),
  },
  {
    id: "lab5",
    title: "Right-size models per agent",
    mins: 8,
    live: true,
    goal: "Cut cost and latency by giving simple agents a small model and keeping the large model for judgement.",
    steps: [
      <>
        In <F>src/lib/orchestrator/llm.ts</F>, add a routing table above <F>callLLM</F>:
        <Code>{`const MODEL_BY_AGENT: Partial<Record<AgentId, string>> = {
  intake: "openai/gpt-oss-20b",     // extraction: small and fast
  comms: "openai/gpt-oss-20b",      // templated writing
  // policy / fraud / settlement / reviewer keep the big model
};`}</Code>
      </>,
      <>
        At the top of <F>callLLM</F>, resolve the model and use it in both the Groq call and the emitted event:
        <Code>{`const model = (opts.agent !== "traditional" && MODEL_BY_AGENT[opts.agent]) || opts.model;`}</Code>
      </>,
      <>Run the same scenario before and after. Compare tokens, latency, and the quality of the Intake output in the Inspector.</>,
    ],
    expect: "Lower latency on Intake and Comms, with no loss of decision quality. This is the heterogeneous-model pattern used in production.",
    solution: (
      <p>
        Model names change over time. Pick from the Studio&apos;s model dropdown, which lists your account&apos;s live Groq models. Discuss: which agents can never be
        downgraded? (Reviewer and Fraud, where errors are expensive.)
      </p>
    ),
  },
  {
    id: "lab6",
    title: "Stretch: take it to production",
    mins: 0,
    goal: "Discussion and take-home challenges.",
    steps: [
      <>
        <b>Durable HITL:</b> replace <F>MemorySaver</F> with <F>@langchain/langgraph-checkpoint-postgres</F> so approvals survive restarts and work across serverless instances.
      </>,
      <>
        <b>MCP tools:</b> expose <F>getPolicy</F> and <F>getClaimHistory</F> through an MCP server so any agent framework can use them.
      </>,
      <>
        <b>New industry:</b> re-skin the graph for manufacturing (sensor alert → diagnosis ∥ parts inventory ∥ safety → work-order planner → supervisor approval).
      </>,
      <>
        <b>Evals:</b> write a golden set of 20 FNOL messages and assert the Intake output and final decision. Run it in CI.
      </>,
    ],
    expect: "A roadmap from demo to platform.",
  },
];

export default function LabPage() {
  const total = LABS.reduce((s, l) => s + l.mins, 0);
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10">
      <header>
        <div className="text-sm text-accent-2">Part 4 · Hands-on</div>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Hands-on lab</h1>
        <p className="mt-3 text-muted">
          About {total} minutes of guided exercises: observe, change a rule, trigger reflection, add an agent, then optimise. Labs marked{" "}
          <span className="rounded bg-accent/20 px-1.5 text-xs text-accent">LIVE LLM</span> need a Groq key; the others also work in simulation mode.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {LABS.map((l) => (
            <a key={l.id} href={`#${l.id}`} className="rounded-md border border-line px-2.5 py-1 text-sm hover:border-accent">
              {l.title}
            </a>
          ))}
        </nav>
      </header>

      {LABS.map((l, i) => (
        <section key={l.id} id={l.id} className="card scroll-mt-20 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/20 font-mono text-accent">{i}</span>
            <h2 className="text-xl font-semibold">{l.title}</h2>
            {l.mins > 0 && <span className="text-sm text-muted">~{l.mins} min</span>}
            {l.live && <span className="rounded bg-accent/20 px-1.5 text-xs text-accent">LIVE LLM</span>}
          </div>
          <p className="mt-2 text-ink/85">🎯 {l.goal}</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed marker:text-muted">
            {l.steps.map((s, j) => (
              <li key={j}>{s}</li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm">
            <b className="text-ok">Expected:</b> {l.expect}
          </div>
          {l.solution && (
            <details className="mt-3 rounded-lg border border-line p-3 text-sm">
              <summary className="cursor-pointer font-medium text-accent">Show answer / solution</summary>
              <div className="mt-2 text-ink/85">{l.solution}</div>
            </details>
          )}
        </section>
      ))}

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Discussion questions</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink/85">
          <li>Which of your current client workflows has unstructured input, several systems, and a human approval step? That is your first agentic candidate.</li>
          <li>Where would you put deterministic code instead of an LLM in that workflow?</li>
          <li>What evidence would a regulator or auditor ask for, and does your trace provide it?</li>
          <li>What is the cost per transaction at 8 LLM calls, and what manual effort does it replace?</li>
          <li>Which decisions must <i>always</i> stay with a human?</li>
        </ul>
        <Link href="/studio" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold">
          Back to the Studio →
        </Link>
      </section>
    </main>
  );
}
