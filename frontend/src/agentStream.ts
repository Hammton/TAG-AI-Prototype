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
      /** Present when Stage-1 intake dialogue is in progress */
      intake_document?: string;
      order_document?: string;
      intelligence_briefs?: Array<{
        query: string;
        summary: string;
        results: Array<{ source: string; title: string; snippet: string; url: string; relevance: "HIGH" | "MEDIUM" | "LOW" }>;
        retrieved_at: string;
      }>;
      /** Present when Stage-1 intake dialogue includes conflict detection */
      conflicts?: Array<{
        type: "CONFLICT" | "WARNING" | "SUGGESTION";
        severity: "HIGH" | "MEDIUM" | "LOW";
        message: string;
        fields: string[];
        options: string[];
        explanation: string;
        tradeoffs?: Array<{
          option: string;
          impact: { weight_kg?: number; cost_usd?: number; timeline_months?: number };
          pros: string[];
          cons: string[];
          feasibility: "STANDARD" | "ENGINEERED" | "R&D";
        }>;
      }>;
      suggestions?: Array<{
        category: "CUSTOMER_PATTERN" | "THREAT_IMPLICATION" | "ORDER_SIZE" | "TECH_TRANSFER";
        message: string;
        rationale: string;
      }>;
      vehicle_preview?: {
        vehicle_model_id: string;
        model_code: string;
        type: string;
        score: number;
        fit_summary: string;
        gaps: string[];
        proactive_gaps?: Array<{
          field: string;
          label: string;
          question: string;
          rationale: string;
          priority: "HIGH" | "MEDIUM" | "LOW";
          source: "PATTERN_MATCH" | "ROLE_CROSS_REFERENCE" | "CONTRADICTION" | "EXTERNAL_INTELLIGENCE";
        }>;
        estimated_price_usd: number | null;
      };
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

export type AgentStreamResult<T> = {
  mode: string;
  result: T;
  engine: "langchain" | "stub";
  record_id: string | null;
};

/** Pull complete JSON objects from a buffer (NDJSON or concatenated objects). */
function extractJsonObjects(buffer: string): {
  events: AgentActivityEvent[];
  remaining: string;
} {
  const events: AgentActivityEvent[] = [];
  let i = 0;

  while (i < buffer.length) {
    while (i < buffer.length && /\s/.test(buffer[i]!)) i++;
    if (i >= buffer.length) break;

    const start = buffer[i];
    if (start !== "{" && start !== "[") {
      const next = buffer.indexOf("{", i);
      if (next === -1) break;
      i = next;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;
    let j = i;

    for (; j < buffer.length; j++) {
      const c = buffer[j]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }

    if (depth !== 0) break;

    const slice = buffer.slice(i, j);
    try {
      events.push(JSON.parse(slice) as AgentActivityEvent);
    } catch {
      break;
    }
    i = j;
  }

  return { events, remaining: buffer.slice(i) };
}

function handleEvent(
  event: AgentActivityEvent,
  onEvent: (event: AgentActivityEvent) => void,
  final: { value: AgentStreamResult<unknown> | null },
) {
  if (event.type === "error") {
    throw new Error(event.message);
  }
  if (event.type === "result") {
    final.value = {
      mode: event.mode,
      result: event.result,
      engine: event.engine,
      record_id: event.record_id,
    };
    return;
  }
  onEvent(event);
}

function parseSseChunk(
  chunk: string,
  sseBuffer: string,
  onEvent: (event: AgentActivityEvent) => void,
  final: { value: AgentStreamResult<unknown> | null },
): string {
  const combined = sseBuffer + chunk;
  const parts = combined.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    const dataLines = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.replace(/^data:\s?/, "").trim())
      .join("");

    if (!dataLines) continue;

    const { events } = extractJsonObjects(dataLines);
    for (const event of events) {
      handleEvent(event, onEvent, final);
    }
  }

  return rest;
}

export function friendlyAgentError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("JSON") ||
    msg.includes("position") ||
    msg.includes("Unexpected")
  ) {
    return "The response was interrupted. Please run that step again.";
  }
  if (msg.includes("agent_loop_limit")) {
    return "This request needed too many steps. Try again or simplify the configuration.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "Cannot reach the server. Check that the backend is running on port 3001.";
  }
  if (msg.includes("validation_error")) {
    return "Invalid request. Check client, vehicle, and quantity are set.";
  }
  if (msg.includes("Provider returned error") || msg.includes("OPENROUTER")) {
    return "The AI provider is temporarily unavailable. Restart the backend after updating OPENROUTER_MODEL_DEV, or try again in a moment.";
  }
  if (msg.length > 120) {
    return "Something went wrong. Please try again.";
  }
  return msg;
}

export async function streamAgent<T>(
  body: Record<string, unknown>,
  onEvent: (event: AgentActivityEvent) => void,
): Promise<AgentStreamResult<T>> {
  const res = await fetch("/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* plain text error */
    }
    throw new Error(message);
  }

  if (!res.body) {
    return streamAgentFallback<T>(body, onEvent);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let ndjsonBuffer = "";
  let sseBuffer = "";
  const final: { value: AgentStreamResult<unknown> | null } = { value: null };
  const contentType = res.headers.get("content-type") ?? "";
  const isSse = contentType.includes("text/event-stream");

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      if (isSse) {
        sseBuffer = parseSseChunk(chunk, sseBuffer, onEvent, final);
      } else {
        ndjsonBuffer += chunk;
        const { events, remaining } = extractJsonObjects(ndjsonBuffer);
        ndjsonBuffer = remaining;
        for (const event of events) {
          handleEvent(event, onEvent, final);
        }
      }
    }

    if (isSse && sseBuffer.trim()) {
      parseSseChunk("\n\n", sseBuffer, onEvent, final);
    } else if (!isSse && ndjsonBuffer.trim()) {
      const { events } = extractJsonObjects(ndjsonBuffer);
      for (const event of events) {
        handleEvent(event, onEvent, final);
      }
    }
  } catch (err) {
    throw err;
  }

  if (!final.value) {
    return streamAgentFallback<T>(body, onEvent);
  }

  return final.value as AgentStreamResult<T>;
}

async function streamAgentFallback<T>(
  body: Record<string, unknown>,
  onEvent: (event: AgentActivityEvent) => void,
): Promise<AgentStreamResult<T>> {
  onEvent({
    type: "phase",
    phase: "fallback",
    message: "Completing request…",
  });

  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  const data = (await res.json()) as AgentStreamResult<T>;
  return data;
}
