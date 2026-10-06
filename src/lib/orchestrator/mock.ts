// Simulation mode: a rule-based stand-in for the LLM so the full orchestration can run
// offline (no GROQ_API_KEY, bad venue Wi-Fi, rate limits). Only the LLM is simulated —
// the graph, routing, tools, state, HITL and telemetry are all real.

import { TODAY } from "./data";

export const isMockMode = () => process.env.CLAIMFLOW_MOCK === "1" || !process.env.GROQ_API_KEY;

const has = (t: string, re: RegExp) => re.test(t);

function classify(q: string) {
  if (has(q, /poem|forget|ignore (all|previous)|another customer|other customer|joke/i)) return "OUT_OF_SCOPE";
  if (has(q, /hit|damag|scratch|broke|rear-ended|crash|stolen|accident|dent/i) && has(q, /claim|process|cover it|payment|need/i) && !has(q, /^does|if i/i))
    return "NEW_CLAIM";
  if (has(q, /cover|covered|coverage/i)) return "COVERAGE_QUERY";
  return "GENERAL_INFO";
}

const PART_PATTERNS: Array<[RegExp, string]> = [
  [/front bumper/i, "front_bumper"],
  [/rear bumper/i, "rear_bumper"],
  [/hood|bonnet/i, "hood"],
  [/headlights?/i, "headlight"],
  [/tail ?lights?/i, "tail_light"],
  [/windshield|windscreen/i, "windshield"],
  [/door/i, "door"],
  [/side mirror|mirror/i, "side_mirror"],
  [/fender/i, "fender"],
  [/radiator/i, "radiator"],
  [/airbags?/i, "airbag_system"],
  [/scratch/i, "paint_repair"],
];

function extract(q: string) {
  const name = q.match(/(?:this is|[Ii]'?m|[Ii] am)\s+([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1] ?? q.match(/^([A-Z][a-z]+ [A-Z][a-z]+) here/)?.[1] ?? null;
  const policy = q.match(/POL-?\s?(\d{4})/i);
  let date: string | null = null;
  const oct = q.match(/Oct(?:ober)?\s+(\d{1,2})/i);
  if (oct) date = `2026-10-${oct[1].padStart(2, "0")}`;
  else if (/yesterday|last night/i.test(q)) date = new Date(Date.parse(TODAY) - 86_400_000).toISOString().slice(0, 10);
  const type = /scratch|keyed|vandal/i.test(q)
    ? "vandalism"
    : /stolen|theft/i.test(q)
      ? "theft"
      : /hail|flood|storm/i.test(q)
        ? "weather"
        : /hit|rear-ended|crash|collid|wall|pole/i.test(q)
          ? "collision"
          : null;
  const parts = PART_PATTERNS.filter(([re]) => re.test(q)).map(([re, part]) => ({
    part,
    qty: new RegExp(`(both|two|2)\\s+(\\w+\\s+)?(?:${re.source})`, "i").test(q) || (part === "headlight" && /headlights/i.test(q)) ? 2 : 1,
  }));
  return {
    claimant_name: name,
    policy_id: policy ? `POL-${policy[1]}` : null,
    incident_date: date,
    location: q.match(/(?:on|at|in) (?:a )?([A-Z][\w ]+?(?:Road|Street|parking lot|signal))/)?.[1] ?? (/parking lot/i.test(q) ? "parking lot" : null),
    incident_type: type,
    description: q.slice(0, 160),
    damaged_parts: parts,
    injuries: /injur/i.test(q) && !/no injur/i.test(q),
    police_report: /no police report/i.test(q) ? false : /police report (filed|made)|filed a police/i.test(q) ? true : null,
  };
}

export function mockLLM(agent: string, user: string): string {
  const data = (() => {
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  })();

  switch (agent) {
    case "orchestrator": {
      const intent = classify(user);
      return JSON.stringify({
        intent,
        agents: intent === "NEW_CLAIM" ? ["policy", "fraud", "damage"] : intent === "COVERAGE_QUERY" ? ["policy"] : [],
        needs_settlement: intent === "NEW_CLAIM",
        reasoning: {
          NEW_CLAIM: "Customer reports vehicle damage and asks for the claim to be processed.",
          COVERAGE_QUERY: "Customer asks a hypothetical coverage question; only policy verification is needed.",
          GENERAL_INFO: "General question about the claims process; answer from the knowledge base.",
          OUT_OF_SCOPE: "Request is unrelated to motor claims and attempts to access another customer's data.",
        }[intent],
        out_of_scope_reason: intent === "OUT_OF_SCOPE" ? "Off-topic request plus an attempt to access another customer's data" : null,
      });
    }
    case "intake":
      return JSON.stringify(extract(user));
    case "policy": {
      const failed = (data?.ruleChecks ?? []).filter((c: { pass: boolean | null }) => c.pass === false);
      const p = data?.policy;
      return JSON.stringify({
        covered: failed.length ? false : true,
        explanation: failed.length
          ? `Not covered: ${failed.map((c: { rule: string; detail: string }) => `${c.rule} failed (${c.detail})`).join("; ")}.`
          : `Covered under the ${p?.plan} plan for ${p?.vehicle}. A deductible of $${p?.deductible} applies, up to a limit of $${p?.limit}.`,
      });
    }
    case "fraud": {
      const n = data?.signals?.length ?? 0;
      return JSON.stringify({
        adjustment: n >= 3 ? 5 : n === 0 ? -2 : 0,
        rationale:
          n === 0
            ? "No adverse indicators; narrative is consistent and the claims history is normal."
            : `Indicators present: ${data.signals.map((s: { signal: string }) => s.signal).join("; ")}. Damage pattern on a new policy warrants verification.`,
      });
    }
    case "damage": {
      const total = data?.estimate?.total ?? 0;
      const sev = total > 6000 ? "severe" : total > 2000 ? "moderate" : "minor";
      return JSON.stringify({
        severity: sev,
        assessment: `Estimated repair cost $${total} for ${data?.vehicle ?? "the vehicle"}. ${sev === "severe" ? "Safety-critical components affected; physical inspection advised." : "Cosmetic and lighting repairs; desk assessment is sufficient."}`,
      });
    }
    case "settlement": {
      const pe = data?.payoutEngine;
      return JSON.stringify({
        rationale: `Decision ${pe?.decision} with payout $${pe?.payout}. ${pe?.formula ?? ""} Basis: ${(pe?.reasons ?? []).join("; ")}.`,
      });
    }
    case "reviewer":
      return JSON.stringify({ approved: true, issues: [], feedback: "" });
    case "comms": {
      const facts = JSON.parse(user.split("Facts: ")[1] ?? "{}");
      if (facts.intent === "OUT_OF_SCOPE")
        return "I'm sorry, I can only help with Apex Mutual motor insurance claims, and I can't share any other customer's information. I can file a claim, check your coverage, or explain the claims process.";
      if (facts.intent === "GENERAL_INFO")
        return `Happy to help!\n\n${(facts.faq ?? []).map((f: { topic: string; answer: string }) => `**${f.topic}:** ${f.answer}`).join("\n\n")}`;
      if (facts.intent === "COVERAGE_QUERY") return `Thanks for checking. ${facts.coverage?.explanation ?? ""}`;
      const name = facts.claimant ? `Hi ${facts.claimant.split(" ")[0]},` : "Hello,";
      if (facts.pendingHumanReview) return `${name}\n\nYour claim **${facts.claimId}** has been received and is being reviewed by a claims adjuster.`;
      if (facts.decision === "APPROVE")
        return `${name}\n\nGood news: your claim **${facts.claimId}** is **approved**. We'll pay **$${facts.payout}** (repair estimate $${facts.damageEstimate?.estimate} less your $${facts.deductible} deductible) within 3 business days.${facts.coverage?.addOns?.includes("rental_car") ? " Your policy also includes a rental car while repairs are done." : ""}`;
      if (facts.adjuster && !facts.adjuster.approved)
        return `${name}\n\nThank you for reporting this. Your claim **${facts.claimId}** has been referred for further review, and an adjuster will contact you within 2 business days.`;
      return `${name}\n\nWe're sorry, but we can't cover claim **${facts.claimId}**. ${facts.coverage?.explanation ?? ""} Please contact us if you have questions.`;
    }
    case "traditional":
      return `Thank you for contacting Apex Mutual Insurance. I'm sorry to hear about the incident.\n\nBased on your description, this looks like it is covered under your auto policy. The estimated repair cost is likely $1,500–$4,000, depending on the parts involved. Your claim has been approved, and payment will be processed shortly after you send photos of the damage.\n\n_(Simulation mode: illustrates a typical single-prompt reply with no access to the policy, claims history or pricing systems.)_`;
    default:
      return "{}";
  }
}
