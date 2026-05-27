export type AgentActivityEvent =
  | { type: "phase"; phase: string; message: string }
  | {
      type: "tool";
      tool: string;
      state: "start" | "done" | "error";
      message: string;
    }
  | { type: "thinking"; message: string; live?: boolean }
  | { type: "token"; text: string }
  | { type: "route"; intent: string }
  | {
      type: "message_done";
      reply: string;
      recommendation?: unknown;
      artifact_kind?: "spec" | "quote" | "engineering";
      artifact_result?: unknown;
      engine: "langchain" | "stub";
      record_id?: string | null;
    }
  | {
      type: "result";
      mode: string;
      result: unknown;
      engine: "langchain" | "stub";
      record_id: string | null;
    }
  | { type: "error"; message: string };

export type ActivityEmitter = (event: AgentActivityEvent) => void;

function summarizeToolArgs(tool: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  const parts: string[] = [];
  if (a.client_id) parts.push(`client_id=${a.client_id}`);
  if (a.vehicle_model_id) parts.push(`vehicle_model_id=${a.vehicle_model_id}`);
  if (a.order_id) parts.push(`order_id=${a.order_id}`);
  if (a.vehicle_type) parts.push(`vehicle_type=${a.vehicle_type}`);
  if (typeof a.user_text === "string" && a.user_text.trim()) {
    const s = a.user_text.trim();
    parts.push(
      `user_text="${s.length > 72 ? `${s.slice(0, 72)}…` : s}"`,
    );
  }
  if (a.query && typeof a.query === "string") {
    parts.push(`query="${a.query.slice(0, 48)}${a.query.length > 48 ? "…" : ""}"`);
  }
  if (parts.length === 0 && tool === "list_vehicle_models") return "all models";
  return parts.join(", ");
}

export function formatToolActivity(
  tool: string,
  state: "start" | "done" | "error",
  args?: unknown,
): string {
  const argStr = summarizeToolArgs(tool, args);
  if (state === "start") {
    return argStr ? `${tool}(${argStr})` : tool;
  }
  if (state === "done") {
    return argStr ? `✓ ${tool}(${argStr})` : `✓ ${tool}`;
  }
  return argStr ? `✗ ${tool}(${argStr})` : `✗ ${tool}`;
}

export function emitToolActivity(
  emit: ActivityEmitter | undefined,
  tool: string,
  state: "start" | "done" | "error",
  args?: unknown,
) {
  if (!emit) return;
  emit({
    type: "tool",
    tool,
    state,
    message: formatToolActivity(tool, state, args),
  });
}
