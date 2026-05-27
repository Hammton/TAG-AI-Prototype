import type { AgentActivityEvent } from "./agentStream";
import { friendlyAgentError, streamAgent } from "./agentStream";
import type { Audience, ArtifactKey } from "./types";

export type MessageDoneEvent = Extract<AgentActivityEvent, { type: "message_done" }>;

export type StreamMessageHandlers = {
  onEvent: (event: AgentActivityEvent) => void;
  onToken: (text: string) => void;
  onDone: (event: MessageDoneEvent) => void;
};

export async function streamUserMessage(
  body: Record<string, unknown>,
  handlers: StreamMessageHandlers,
): Promise<MessageDoneEvent> {
  const res = await fetch("/api/message/stream", {
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
      /* plain text */
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Streaming not supported");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let doneEvent: MessageDoneEvent | null = null;

  const yieldFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const processEvent = async (event: AgentActivityEvent) => {
    if (event.type === "error") {
      throw new Error(event.message);
    }
    if (event.type === "token") {
      handlers.onToken(event.text);
      await yieldFrame();
      return;
    }
    if (event.type === "message_done") {
      doneEvent = event;
      handlers.onDone(event);
      return;
    }
    handlers.onEvent(event);
    await yieldFrame();
  };

  const extractJsonObjects = (buffer: string) => {
    const events: AgentActivityEvent[] = [];
    let i = 0;
    while (i < buffer.length) {
      while (i < buffer.length && /\s/.test(buffer[i]!)) i++;
      if (i >= buffer.length) break;
      if (buffer[i] !== "{") {
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
      try {
        events.push(JSON.parse(buffer.slice(i, j)) as AgentActivityEvent);
      } catch {
        break;
      }
      i = j;
    }
    return { events, remaining: buffer.slice(i) };
  };

  const parseSseChunk = async (chunk: string) => {
    const combined = sseBuffer + chunk;
    const parts = combined.split("\n\n");
    sseBuffer = parts.pop() ?? "";
    for (const part of parts) {
      const dataLines = part
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, "").trim())
        .join("");
      if (!dataLines) continue;
      const { events } = extractJsonObjects(dataLines);
      for (const event of events) await processEvent(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await parseSseChunk(decoder.decode(value, { stream: true }));
  }

  if (sseBuffer.trim()) {
    await parseSseChunk("\n\n");
  }

  if (!doneEvent) {
    throw new Error("Stream ended without a response");
  }

  return doneEvent;
}

/** Quick actions still use legacy agent stream until migrated. */
export { friendlyAgentError, streamAgent };
export type { Audience, ArtifactKey };
