import { getStore } from "../../data/index.js";

export async function getCustomRequirements(order_id: string) {
  return getStore().getCustomRequirements(order_id);
}

export async function getCadMetadata(vehicle_model_id: string) {
  return getStore().getCadMetadata(vehicle_model_id);
}

function scoreContextChunk(text: string, query: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const token of query.split(/\s+/).filter((x) => x.length > 2)) {
    if (t.includes(token)) score += 3;
  }
  for (const token of [
    "protection",
    "blast",
    "suspension",
    "run-flat",
    "validation",
    "integration",
    "mission",
    "mobility",
    "compliance",
  ]) {
    if (t.includes(token)) score += 1;
  }
  return score;
}

export async function searchBuildContext(
  query: string,
  vehicle_model_id: string,
  limit = 3,
) {
  const expandedQuery = query.toLowerCase();
  const hints = [
    query,
    "protection",
    "blast",
    "run-flat",
    "suspension",
    "engineering",
    "integration",
    "validation",
    "mission",
    "mobility",
    "compliance",
  ];

  const searched = await Promise.all(
    hints.map((q) => getStore().searchBuildContext(q, vehicle_model_id, Math.ceil(limit / 2))),
  );

  const merged = searched
    .flat()
    .map((r) => r.text)
    .filter(Boolean)
    .filter((text, i, arr) => arr.indexOf(text) === i);

  const ranked = merged.sort((a, b) => {
    const as = scoreContextChunk(a, expandedQuery);
    const bs = scoreContextChunk(b, expandedQuery);
    return bs - as;
  });

  return ranked.slice(0, Math.max(limit, 8)).map((text) => ({ text }));
}

export async function createSalesOrderFromEngagement(input: {
  engagement_ref: string;
  sales_order_ref: string;
  vehicle_model_id: string;
  quantity: number;
}) {
  return getStore().createSalesOrderFromEngagement(input);
}

export async function buildStage3SpecSections(input: {
  sales_order_ref: string;
  spec_document_number: string;
  generated_by?: string;
}) {
  return getStore().buildStage3SpecSections(input);
}

export async function persistSpecTraceability(input: { spec_document_number: string }) {
  return getStore().persistSpecTraceability(input);
}

export async function createOrUpdateEngagementRequirements(input: {
  engagement_ref: string;
  requirements: Array<{
    section: string;
    parameter: string;
    value_text: string;
    priority?: "MANDATORY" | "DESIRED" | "OPTIONAL";
    source?: "CUSTOMER" | "AM_ASSUMED" | "ENGINEERING_DEFAULT";
    confirmed?: boolean;
  }>;
}) {
  return getStore().createOrUpdateEngagementRequirements(input);
}

export async function runRequirementMatch(input: {
  engagement_ref: string;
  vehicle_model_id?: string;
}) {
  return getStore().runRequirementMatch(input);
}
