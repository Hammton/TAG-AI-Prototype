import type { ActivityEmitter } from "./activity.js";

/** Streams model text into rolling thinking events (replaced on each delta). */
export class LiveThinking {
  private buffer = "";

  constructor(private readonly emit?: ActivityEmitter) {}

  push(delta: string): void {
    if (!this.emit || !delta) return;
    this.buffer += delta;
    const message = this.buffer.trim();
    if (!message) return;
    this.emit({
      type: "thinking",
      message: message.length > 400 ? `…${message.slice(-400)}` : message,
      live: true,
    });
  }

  /** Finalize current line so the next push starts a new bullet. */
  finalize(note?: string): void {
    if (!this.emit) return;
    const message = (note ?? this.buffer).trim();
    if (message && shouldSurfaceAsThinking(message)) {
      this.emit({ type: "thinking", message });
    }
    this.buffer = "";
  }
}

export function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const part = p as { type?: string; text?: string; thinking?: string };
          if (part.type === "thinking" && part.thinking) return part.thinking;
          if (part.text) return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function extractReasoningDelta(chunk: {
  additional_kwargs?: Record<string, unknown>;
}): string {
  const kwargs = chunk.additional_kwargs ?? {};
  for (const key of ["reasoning", "reasoning_content", "thinking"]) {
    const v = kwargs[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

const JSON_PAYLOAD_MARKERS =
  /recommended_vehicle|vehicle_model_id|configuration_option|tool_call|"intent"|"reply"|"mode"|has_history|next_actions/i;

/** Skip JSON/tool payloads; surface natural language model output. */
export function shouldSurfaceAsThinking(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return false;
  if (t.startsWith("```")) return false;
  if (JSON_PAYLOAD_MARKERS.test(t)) return false;
  if (t.includes("{") && t.includes("}") && t.length > 48) return false;
  if (/^[\s{}\[\]",:0-9a-zA-Z_-]+$/.test(t) && (t.includes("{") || t.includes('"'))) {
    return false;
  }
  return true;
}
