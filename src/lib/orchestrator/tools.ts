// Deterministic tools the agents call. Business rules live here, not inside prompts:
// LLMs reason over the results, but they never invent the numbers.

import {
  CLAIM_HISTORY,
  CLAIMS_FAQ,
  CLASS_MULTIPLIER,
  LABOUR_RATE,
  PARTS_CATALOG,
  POLICIES,
  TODAY,
  type Policy,
} from "./data";

// Business rules (authority matrix). Lab 2: change these and watch the routing change.
export const STP_PAYOUT_LIMIT = 15000; // above this, a human adjuster must approve
export const FRAUD_REVIEW_THRESHOLD = 60; // SIU referral score

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const isDate = (d: unknown): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d));

export function lookupPolicyId(text: string): string | null {
  const m = text.match(/POL-?\s?(\d{4})/i);
  return m ? `POL-${m[1]}` : null;
}

export function getPolicy(policyId: string | null): Policy | { error: string } {
  if (!policyId) return { error: "No policy number supplied" };
  return POLICIES[policyId.toUpperCase()] ?? { error: `Policy ${policyId} not found` };
}

export function checkCoverageRules(policy: Policy, incidentType: string | null, incidentDate: string | null) {
  const checks: Array<{ rule: string; pass: boolean | null; detail: string }> = [];
  const date = isDate(incidentDate) ? incidentDate : null;

  checks.push({
    rule: "Policy status is ACTIVE",
    pass: policy.status === "ACTIVE",
    detail: `Status: ${policy.status}${policy.notes ? ` — ${policy.notes}` : ""}`,
  });
  checks.push({
    rule: "Incident within policy period",
    pass: date ? date >= policy.startDate && date <= policy.endDate : null,
    detail: date ? `Incident ${date}; period ${policy.startDate} → ${policy.endDate}` : "Incident date unknown",
  });

  const ownDamagePerils = ["collision", "theft", "vandalism", "weather", "fire"];
  const type = (incidentType ?? "").toLowerCase();
  const perilCovered = type ? policy.coveredPerils.includes(type) : null;
  checks.push({
    rule: "Peril covered by plan",
    pass: perilCovered,
    detail: type
      ? `${type} under ${policy.plan}: ${perilCovered ? "covered" : "NOT covered"}${
          !perilCovered && ownDamagePerils.includes(type) ? " (own-damage excluded)" : ""
        }`
      : "Incident type unknown",
  });

  const hardFail = checks.some((c) => c.pass === false);
  return {
    covered: hardFail ? false : checks.every((c) => c.pass === true) ? true : null,
    checks,
    deductible: policy.deductible,
    limit: policy.limit,
  };
}

export function getClaimHistory(customerId: string) {
  const claims = CLAIM_HISTORY[customerId] ?? [];
  const last12m = claims.filter((c) => daysBetween(c.date, TODAY) <= 365);
  return { totalClaims: claims.length, claimsLast12Months: last12m.length, claims };
}

export function runFraudRules(input: {
  policy: Policy | null;
  incidentDate: string | null;
  policeReport: boolean | null;
  damagedPartsCount: number;
  claimsLast12Months: number;
  text: string;
}) {
  const signals: Array<{ signal: string; weight: number }> = [];
  const { policy, incidentDate } = input;

  if (policy && isDate(incidentDate)) {
    const tenure = daysBetween(policy.startDate, incidentDate);
    if (tenure >= 0 && tenure < 30) signals.push({ signal: `Incident only ${tenure} days after policy inception`, weight: 25 });
    if (incidentDate < policy.startDate || incidentDate > policy.endDate)
      signals.push({ signal: "Incident date outside policy period", weight: 15 });
  }
  if (isDate(incidentDate) && daysBetween(incidentDate, TODAY) > 30)
    signals.push({ signal: "Late reporting (> 30 days)", weight: 10 });
  if (input.claimsLast12Months >= 2)
    signals.push({
      signal: `${input.claimsLast12Months} prior claims in last 12 months`,
      weight: 20 + (input.claimsLast12Months - 2) * 10,
    });
  if (input.policeReport === false && input.damagedPartsCount >= 4)
    signals.push({ signal: "Extensive damage with no police report", weight: 15 });
  if (/\b(fast|urgent|urgently|today|immediately|asap|right now)\b/i.test(input.text))
    signals.push({ signal: "Payment urgency pressure in narrative", weight: 5 });

  const score = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
  return { ruleScore: score, signals };
}

export function estimateRepairCost(parts: Array<{ part: string; qty: number }>, vehicleClass: Policy["vehicleClass"]) {
  const mult = CLASS_MULTIPLIER[vehicleClass];
  const rate = LABOUR_RATE[vehicleClass];
  const lines = [];
  const unknown: string[] = [];
  for (const { part, qty } of parts) {
    const p = PARTS_CATALOG[part];
    if (!p) {
      unknown.push(part);
      continue;
    }
    const q = Math.max(1, Math.round(qty || 1));
    const partsCost = Math.round(p.part * mult * q);
    const labourCost = Math.round(p.hours * q * rate);
    lines.push({ part: p.label, qty: q, partsCost, labourCost, total: partsCost + labourCost });
  }
  const total = lines.reduce((s, l) => s + l.total, 0);
  return { vehicleClass, classMultiplier: mult, labourRate: rate, lines, unknownParts: unknown, total };
}

export function calculatePayout(input: {
  covered: boolean | null;
  estimate: number;
  deductible: number;
  limit: number;
  fraudScore: number;
  injuries: boolean;
  totalLoss: boolean;
}) {
  const reasons: string[] = [];
  if (input.covered === false) {
    return { decision: "DENY" as const, payout: 0, reasons: ["Loss is not covered under the policy"] };
  }
  const capped = Math.min(input.estimate, input.limit);
  const payout = Math.max(0, capped - input.deductible);
  if (input.covered === null) reasons.push("Coverage could not be fully verified");
  if (input.fraudScore >= FRAUD_REVIEW_THRESHOLD)
    reasons.push(`Fraud risk score ${input.fraudScore} ≥ ${FRAUD_REVIEW_THRESHOLD} (SIU threshold)`);
  if (payout > STP_PAYOUT_LIMIT)
    reasons.push(`Payout $${payout} exceeds $${STP_PAYOUT_LIMIT.toLocaleString("en-US")} straight-through limit`);
  if (input.injuries) reasons.push("Bodily injury reported");
  if (input.totalLoss) reasons.push("Potential total loss");
  return {
    decision: reasons.length ? ("HUMAN_REVIEW" as const) : ("APPROVE" as const),
    payout,
    formula: `min(estimate $${input.estimate}, limit $${input.limit}) − deductible $${input.deductible} = $${payout}`,
    reasons: reasons.length ? reasons : ["All straight-through-processing criteria met"],
  };
}

export function searchClaimsFAQ(query: string) {
  const q = query.toLowerCase();
  return CLAIMS_FAQ.map((f) => ({ ...f, hits: f.keywords.filter((k) => q.includes(k)).length }))
    .filter((f) => f.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(({ topic, answer }) => ({ topic, answer }));
}
