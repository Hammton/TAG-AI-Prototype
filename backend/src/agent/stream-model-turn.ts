import { AIMessage, type AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import type { ActivityEmitter } from "./activity.js";
import { createChatModel } from "./llm.js";
import {
  LiveThinking,
  chunkText,
  extractReasoningDelta,
  shouldSurfaceAsThinking,
} from "./live-thinking.js";

type BoundModel = ReturnType<ReturnType<typeof createChatModel>["bindTools"]>;

export async function streamModelTurn(
  llm: BoundModel,
  messages: BaseMessage[],
  onActivity?: ActivityEmitter,
): Promise<AIMessage> {
  const live = new LiveThinking(onActivity);
  let gathered: AIMessageChunk | undefined;

  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    gathered = gathered ? gathered.concat(chunk) : chunk;

    const reasoning = extractReasoningDelta(chunk);
    if (reasoning) live.push(reasoning);

    const text = chunkText(chunk.content);
    if (text && shouldSurfaceAsThinking(text)) {
      live.push(text);
    }
  }

  live.finalize();

  if (!gathered) {
    throw new Error("empty_model_response");
  }

  return new AIMessage(gathered);
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
