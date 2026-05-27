import type { BaseMessage } from "@langchain/core/messages";
import type { ActivityEmitter } from "./activity.js";
import { createChatModel } from "./llm.js";
import { LiveThinking, chunkText, shouldSurfaceAsThinking } from "./live-thinking.js";

/** Stream LLM output as token events for the chat UI. */
export async function streamAssistantText(
  messages: BaseMessage[],
  emit: ActivityEmitter,
  options?: { temperature?: number; mirrorThinking?: boolean },
): Promise<string> {
  const llm = createChatModel({ temperature: options?.temperature ?? 0.45 });
  const live = options?.mirrorThinking ? new LiveThinking(emit) : null;
  let full = "";
  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    const text = chunkText(chunk.content);
    if (!text) continue;
    full += text;
    if (live && shouldSurfaceAsThinking(text)) {
      live.push(text);
    }
    emit({ type: "token", text });
  }
  live?.finalize();
  return full.trim();
}

/** Deterministic stub: emit word-by-word for visible streaming. */
export function emitTextAsTokens(text: string, emit: ActivityEmitter): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/(\s+)/);
  for (const part of parts) {
    if (part) emit({ type: "token", text: part });
  }
  return trimmed;
}
