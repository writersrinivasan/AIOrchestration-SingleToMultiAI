# Presenter Run Sheet: AI Orchestration Masterclass (120 min)

**Audience:** Hexaware engineers, architects and consultants
**Thesis:** Traditional GenAI makes a model *answer*. Agentic orchestration makes a *system* of models, tools and people *complete a business outcome* reliably, observably and under governance.

---

## Before the session (T-30 min)

- [ ] `npm run dev`, open `/studio`, and confirm the badge says **● Live · Groq**.
- [ ] Run all 6 scenarios once to warm up (first compile plus Groq).
- [ ] Keep a second browser tab on `/studio` with `CLAIMFLOW_MOCK=1` running on another port as a fallback: `CLAIMFLOW_MOCK=1 PORT=3001 npm run dev`.
- [ ] Browser zoom: 100–110% on a 1080p projector. Use **⛶ Focus graph** for graph-only moments.
- [ ] Share the repo / zip and the Groq signup link (console.groq.com) in the chat for the lab.

---

## 0:00–0:10 · Opening hook (Studio)

1. Open `/studio`. Leave **Compare vs traditional GenAI** on.
2. Run **Lapsed policy → deny** (Emily, POL-1003).
3. Open the **Compare** tab. The traditional reply often assumes the claim is covered, or invents amounts. The agents found the policy **lapsed**, from the policy system.
4. Ask the room: *"Which of these would you let send a letter to a real customer?"*

> Talking point: the single prompt isn't stupid, it's *blind*. It has no data, no rules, no authority limits and no audit trail. Orchestration fixes the system, not the model.

## 0:10–0:35 · Concepts (`/learn`)

| Min | Section | Key message |
|---|---|---|
| 4 | Evolution | Each stage fixed the previous stage's limit. Agents fix "can't act and can't decide". |
| 7 | Comparison table | Walk through 6–8 rows: control flow, enterprise data, business rules, quality control, human oversight, explainability. |
| 3 | Anatomy of an agent | Role, LLM, tools, state, guardrails, handoff. *Narrow roles beat clever prompts.* |
| 6 | 8 patterns | Each card says where it appears in ClaimFlow, so you'll show all of them live. |
| 5 | How agents communicate | Shared state + routers + supersteps + checkpoints. Show the code snippet. |

## 0:35–0:50 · Use case (`/usecase`)

- Claims is the insurer's moment of truth: CSAT, loss ratio, and regulatory exposure.
- Walk through the lifecycle → agent table. Every row is an existing human role.
- Systems of record → tools. In real deployments these are policy/claims platform APIs, typically behind MCP.
- KPIs are *directional*. Don't quote numbers to a client without their baseline.
- Point at the six scenarios: each one exercises a different path.

## 0:50–1:20 · Live Studio deep dive

| Scenario | What to point at |
|---|---|
| **1. Clean claim (Priya)** | Orchestrator plan → Intake extraction → **3 specialists light up together** (fan-out) → Settlement runs **once** (fan-in). Metrics: *Parallelism saved*. Click Policy → Inspector → `checkCoverageRules()` args/result. Click Settlement → `calculatePayout()`: **the LLM never computes money.** |
| **2. Suspicious claim (Marcus)** | Fraud: rules score (new policy, 2 claims in 12 months, no police report, urgency) + LLM adjustment. Settlement → HUMAN_REVIEW. **Graph pauses**: the state is checkpointed. Approve or reject live; the graph resumes on a *new HTTP request* from the checkpoint. |
| **3. Lapsed policy (Emily)** | The hard rule fails, and the code guardrail stops the LLM overriding it. Compare tab → fact check. |
| **4. Coverage question (Rahul)** | Dynamic routing: 5 agents skipped (dashed). About half the LLM calls, so cheaper and faster. |
| **5. FAQ** | Minimal path, grounded on the FAQ tool. |
| **6. Off-topic / data exfiltration** | The supervisor guardrail short-circuits; **no tool is ever touched.** |

Then:
- **Message Bus** → enable *LLM calls* to show tokens per agent. Talk about cost: right-sized models per agent (Lab 5).
- **⟲ Replay at 0.5×** to re-explain any run without new LLM calls.
- **Inspector → LLM call → "input"**: each agent sees only its state slice (context engineering).

## 1:20–1:50 · Hands-on lab (`/lab`)

| Lab | Min | Notes |
|---|---|---|
| 0 Setup | 5 | Attendees without a key work in simulation mode (Labs 1, 2 and 4 still work). |
| 1 Observe | 7 | Answers are in the page's "Show answer". |
| 2 Change a rule | 5 | `STP_PAYOUT_LIMIT` 15000 → 500. Priya goes to HITL. |
| 4 Add Subrogation agent | 13 | The headline exercise. Fallback: `git apply labs/solutions/lab4-subrogation.patch` (tested). |
| 3 / 5 | as time permits | Need a live key: reflection loop and per-agent models. |

## 1:50–2:00 · Production realities + Q&A (`/learn#production`)

Cover these: determinism, bounded loops, cascading errors, cost/latency, least privilege, observability as compliance evidence, durable checkpoints, evals, **when NOT to use agents**.

Close with: *"Find a workflow with unstructured input, several systems and a human approval step. That's your first agentic candidate."*

---

## Likely questions

- **"Isn't 8 LLM calls more expensive?"** Per transaction, yes. Compare it against the minutes of adjuster time it replaces. Skipping agents, using small models for simple roles and fast inference reduce it further.
- **"What if an agent hallucinates?"** Numbers and rules come from tools. Hard rules can't be overridden. A critic reviews the output. Humans approve high-risk cases. Every step is traced.
- **"Why LangGraph and not CrewAI/AutoGen?"** Explicit state, deterministic control flow, checkpoints and interrupts suit regulated workflows. The patterns transfer to any framework.
- **"How do agents talk to each other?"** Through typed shared state plus router-decided handoffs (shown as messages here). Across frameworks or vendors, protocols such as A2A and MCP standardise this.

## Failure plan

| Problem | Action |
|---|---|
| Groq 429 / slow | Switch to a smaller model in the dropdown, or move to the simulation tab. |
| No internet | Simulation mode. Say so openly: "the LLM is simulated, everything else is real." |
| Run errors mid-demo | Use **⟲ Replay** of the previous successful run. |
