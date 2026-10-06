// Mock "systems of record" for Apex Mutual Insurance (fictional).
// In production these would be the policy admin system, claims DB, parts pricing API, etc.

export type VehicleClass = "standard" | "truck" | "premium" | "ev";

export interface Policy {
  policyId: string;
  customerId: string;
  holder: string;
  vehicle: string;
  vehicleClass: VehicleClass;
  vehicleValue: number;
  plan: "COMPREHENSIVE" | "THIRD_PARTY_LIABILITY";
  coveredPerils: string[];
  deductible: number;
  limit: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "LAPSED";
  addOns: string[];
  notes?: string;
}

export const POLICIES: Record<string, Policy> = {
  "POL-1001": {
    policyId: "POL-1001",
    customerId: "CUST-01",
    holder: "Priya Sharma",
    vehicle: "2022 Toyota Camry",
    vehicleClass: "standard",
    vehicleValue: 24000,
    plan: "COMPREHENSIVE",
    coveredPerils: ["collision", "theft", "vandalism", "weather", "fire"],
    deductible: 500,
    limit: 25000,
    startDate: "2025-03-01",
    endDate: "2027-02-28",
    status: "ACTIVE",
    addOns: ["rental_car", "roadside_assistance"],
  },
  "POL-1002": {
    policyId: "POL-1002",
    customerId: "CUST-02",
    holder: "Rahul Verma",
    vehicle: "2019 Ford F-150",
    vehicleClass: "truck",
    vehicleValue: 28000,
    plan: "THIRD_PARTY_LIABILITY",
    coveredPerils: ["third_party_property", "third_party_injury"],
    deductible: 0,
    limit: 50000,
    startDate: "2026-01-10",
    endDate: "2027-01-09",
    status: "ACTIVE",
    addOns: [],
    notes: "Own-damage (collision to insured vehicle) is excluded under a third-party liability plan.",
  },
  "POL-1003": {
    policyId: "POL-1003",
    customerId: "CUST-03",
    holder: "Emily Carter",
    vehicle: "2023 Tesla Model 3",
    vehicleClass: "ev",
    vehicleValue: 38000,
    plan: "COMPREHENSIVE",
    coveredPerils: ["collision", "theft", "vandalism", "weather", "fire"],
    deductible: 1000,
    limit: 40000,
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    status: "LAPSED",
    addOns: ["roadside_assistance"],
    notes: "Renewal premium unpaid. Policy expired on 2026-05-31; no grace period applies.",
  },
  "POL-1004": {
    policyId: "POL-1004",
    customerId: "CUST-04",
    holder: "Marcus Lee",
    vehicle: "2021 BMW X5",
    vehicleClass: "premium",
    vehicleValue: 52000,
    plan: "COMPREHENSIVE",
    coveredPerils: ["collision", "theft", "vandalism", "weather", "fire"],
    deductible: 750,
    limit: 60000,
    startDate: "2026-09-24",
    endDate: "2027-09-23",
    status: "ACTIVE",
    addOns: ["rental_car"],
  },
};

export interface PriorClaim {
  claimId: string;
  date: string;
  type: string;
  amount: number;
  outcome: string;
}

export const CLAIM_HISTORY: Record<string, PriorClaim[]> = {
  "CUST-01": [{ claimId: "CLM-2023-0412", date: "2023-11-14", type: "weather", amount: 900, outcome: "PAID" }],
  "CUST-02": [],
  "CUST-03": [{ claimId: "CLM-2025-1180", date: "2025-12-02", type: "vandalism", amount: 650, outcome: "PAID" }],
  "CUST-04": [
    { claimId: "CLM-2025-0877", date: "2025-08-19", type: "theft (wheels)", amount: 4200, outcome: "PAID (prior insurer)" },
    { claimId: "CLM-2026-0213", date: "2026-02-11", type: "collision", amount: 6100, outcome: "PAID (prior insurer)" },
    { claimId: "CLM-2026-0655", date: "2026-06-27", type: "collision", amount: 7800, outcome: "WITHDRAWN" },
  ],
};

// Repair catalogue: base part price (USD) and labour hours.
export const PARTS_CATALOG: Record<string, { part: number; hours: number; label: string }> = {
  front_bumper: { part: 450, hours: 3, label: "Front bumper" },
  rear_bumper: { part: 420, hours: 3, label: "Rear bumper" },
  hood: { part: 600, hours: 4, label: "Hood" },
  headlight: { part: 350, hours: 1, label: "Headlight" },
  tail_light: { part: 180, hours: 0.8, label: "Tail light" },
  windshield: { part: 400, hours: 2, label: "Windshield" },
  door: { part: 700, hours: 5, label: "Door" },
  side_mirror: { part: 220, hours: 1, label: "Side mirror" },
  fender: { part: 380, hours: 3, label: "Fender" },
  radiator: { part: 520, hours: 3, label: "Radiator" },
  airbag_system: { part: 2400, hours: 5, label: "Airbag system" },
  trunk_lid: { part: 550, hours: 3, label: "Trunk lid" },
  quarter_panel: { part: 900, hours: 6, label: "Quarter panel" },
  paint_repair: { part: 300, hours: 3, label: "Paint / scratch repair (per panel)" },
  wheel: { part: 400, hours: 0.5, label: "Wheel" },
};

export const CLASS_MULTIPLIER: Record<VehicleClass, number> = { standard: 1, truck: 1.2, premium: 1.7, ev: 1.9 };
export const LABOUR_RATE: Record<VehicleClass, number> = { standard: 95, truck: 95, premium: 110, ev: 120 };

export const CLAIMS_FAQ: Array<{ topic: string; keywords: string[]; answer: string }> = [
  {
    topic: "Documents required",
    keywords: ["document", "documents", "need", "file", "paperwork", "proof"],
    answer:
      "To file a motor claim: policy number, driver's licence, vehicle registration, photos of the damage, date/time/location of the incident, and a police report (mandatory for theft, injuries, or damage above $5,000).",
  },
  {
    topic: "Claim timelines",
    keywords: ["long", "time", "timeline", "days", "how long", "status", "when"],
    answer:
      "Simple claims are usually decided within 24 hours (straight-through processing). Claims needing an adjuster inspection take 5–7 business days. Payment is issued within 3 business days of approval.",
  },
  {
    topic: "How to file",
    keywords: ["how", "file", "start", "report", "claim", "submit"],
    answer:
      "You can file through this assistant, the Apex Mutual mobile app, or by calling 1-800-APEX-CLM, 24/7. Report incidents within 30 days.",
  },
  {
    topic: "Rental car",
    keywords: ["rental", "car", "replacement", "hire"],
    answer: "If your policy has the rental_car add-on, a replacement vehicle is covered up to $40/day for 14 days while yours is repaired.",
  },
  {
    topic: "Towing & roadside",
    keywords: ["tow", "towing", "roadside", "breakdown"],
    answer: "Roadside assistance (if purchased) covers towing up to 50 miles, jump-starts, and lock-outs.",
  },
];

export const TODAY = "2026-10-06";
