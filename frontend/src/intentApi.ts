import type { Audience } from "./types";

export type IntentType =
  | "chat"
  | "recommend"
  | "generate_spec"
  | "generate_quote"
  | "generate_engineering"
  | "client_blocked";

export type IntentResult = {
  intent: IntentType;
  reply?: string;
  agent_text?: string;
  engine: "langchain" | "stub";
};

export async function classifyUserIntent(payload: {
  message: string;
  client_id: string;
  audience: Audience;
  history: { role: "user" | "assistant"; content: string }[];
  has_recommendation: boolean;
  has_vehicle_selected: boolean;
  vehicle_code?: string;
}): Promise<IntentResult> {
  const res = await fetch("/api/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: payload.message,
      client_id: payload.client_id,
      audience: payload.audience,
      history: payload.history.slice(-12),
      has_recommendation: payload.has_recommendation,
      has_vehicle_selected: payload.has_vehicle_selected,
      vehicle_code: payload.vehicle_code,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Intent classification failed (${res.status})`);
  }

  return res.json() as Promise<IntentResult>;
}
