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
  view: "recommendations" | ArtifactKey;
  title: string;
  subtitle: string;
};

export type ChatMessage =
  | { id: string; role: "user"; text: string; at: number }
  | {
      id: string;
      role: "assistant";
      text: string;
      artifacts?: ArtifactRef[];
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
