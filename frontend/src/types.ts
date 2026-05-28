export type Audience = "client" | "am";

export type ArtifactKey = "spec" | "quote" | "engineering";

export type WorkflowStep = "recommend" | ArtifactKey;

export type Artifact = {
  kind: ArtifactKey;
  title: string;
  data: unknown;
  generatedAt: string;
};

export type PastOrderRecommendation = {
  order_id: string;
  rank: number;
  match_reason: string;
  configuration_summary: string;
  configuration_option_ids: string[];
  unit_price_usd: number | null;
  date: string;
};

export type ArtifactRef = {
  id: string;
  view: "recommendations" | "order" | ArtifactKey;
  title: string;
  subtitle: string;
};

export type ConflictTradeoff = {
  option: string;
  impact: {
    weight_kg?: number;
    cost_usd?: number;
    timeline_months?: number;
  };
  pros: string[];
  cons: string[];
  feasibility: "STANDARD" | "ENGINEERED" | "R&D";
};

export type Conflict = {
  type: "CONFLICT" | "WARNING" | "SUGGESTION";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  fields: string[];
  options: string[];
  explanation: string;
  tradeoffs?: ConflictTradeoff[];
};

export type Suggestion = {
  category: "CUSTOMER_PATTERN" | "THREAT_IMPLICATION" | "ORDER_SIZE" | "TECH_TRANSFER";
  message: string;
  rationale: string;
};

export type IntelligenceResult = {
  source: string;
  title: string;
  snippet: string;
  url: string;
  relevance: "HIGH" | "MEDIUM" | "LOW";
};

export type IntelligenceBrief = {
  query: string;
  results: IntelligenceResult[];
  summary: string;
  retrieved_at: string;
};

export type ProactiveGap = {
  field: string;
  label: string;
  question: string;
  rationale: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  source: "PATTERN_MATCH" | "ROLE_CROSS_REFERENCE" | "CONTRADICTION" | "EXTERNAL_INTELLIGENCE";
};

export type VehiclePreview = {
  vehicle_model_id: string;
  model_code: string;
  type: string;
  score: number;
  fit_summary: string;
  gaps: string[];
  proactive_gaps?: ProactiveGap[];
  estimated_price_usd: number | null;
};

export type ChatMessage =
  | { id: string; role: "user"; text: string; at: number }
  | {
      id: string;
      role: "assistant";
      text: string;
      artifacts?: ArtifactRef[];
      /** Functional AI intelligence */
      conflicts?: Conflict[];
      suggestions?: Suggestion[];
      vehicle_preview?: VehiclePreview;
      intelligence_briefs?: IntelligenceBrief[];
      streaming?: boolean;
      at: number;
    }
  | {
      id: string;
      role: "working";
      label: string;
      step: WorkflowStep;
      events: import("./agentStream").AgentActivityEvent[];
      expanded: boolean;
      active: boolean;
      at: number;
    };
