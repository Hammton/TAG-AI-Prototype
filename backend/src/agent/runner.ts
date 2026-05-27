import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { getEnv, getActiveModel } from "../config.js";
import type { AgentRequest } from "../schemas/agent.js";
import { createChatModel } from "./llm.js";
import { getToolsForMode } from "./langchain-tools.js";
import { emitToolActivity, type ActivityEmitter } from "./activity.js";
import { buildUserMessage, getSystemPrompt } from "./prompts.js";
import { streamModelTurn } from "./stream-model-turn.js";

function parseJsonFromContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

export async function runLangChainAgent(
  req: AgentRequest,
  onActivity?: ActivityEmitter,
): Promise<unknown> {
  const env = getEnv();
  const tools = getToolsForMode(req.mode);
  const llm = createChatModel().bindTools(tools);

  const messages: BaseMessage[] = [
    new SystemMessage(getSystemPrompt(req.mode)),
    new HumanMessage(buildUserMessage(req)),
  ];

  onActivity?.({
    type: "thinking",
    message: `Model: ${getActiveModel()} · mode: ${req.mode}`,
  });

  for (let i = 0; i <= env.AGENT_MAX_TOOL_ITERATIONS; i++) {
    const response = await streamModelTurn(llm, messages, onActivity);
    messages.push(response);

    const toolCalls = response.tool_calls ?? [];
    console.log(
      `[agent] iteration ${i + 1} — tool_calls: ${toolCalls.length === 0 ? "none (final)" : toolCalls.map((c) => c.name).join(", ")}`,
    );

    if (toolCalls.length === 0) {
      const text =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);
      console.log(`[agent] final response (first 300 chars): ${text.slice(0, 300)}`);
      return parseJsonFromContent(text);
    }

    if (i === env.AGENT_MAX_TOOL_ITERATIONS) {
      throw new Error("agent_loop_limit");
    }

    const toolMessages = await Promise.all(
      toolCalls.map(async (call): Promise<ToolMessage> => {
        const tool = tools.find((t) => t.name === call.name);
        const toolCallId = call.id ?? call.name;
        const args =
          typeof call.args === "string"
            ? (JSON.parse(call.args) as unknown)
            : call.args;

        if (call.name) {
          emitToolActivity(onActivity, call.name, "start", args);
        }

        if (!tool) {
          console.log(`[agent] unknown tool: ${call.name}`);
          return new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
          });
        }

        try {
          console.log(`[agent] calling tool: ${call.name}`, JSON.stringify(args));
          const output = await (
            tool as { invoke: (input: unknown) => Promise<unknown> }
          ).invoke(args);
          const resultText =
            typeof output === "string" ? output : JSON.stringify(output);
          console.log(
            `[agent] tool result (${call.name}): ${resultText.slice(0, 300)}`,
          );
          emitToolActivity(onActivity, call.name, "done", args);
          return new ToolMessage({ tool_call_id: toolCallId, content: resultText });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`[agent] tool error (${call.name}): ${message}`);
          emitToolActivity(onActivity, call.name, "error", args);
          return new ToolMessage({
            tool_call_id: toolCallId,
            content: JSON.stringify({ error: message }),
          });
        }
      }),
    );

    messages.push(...toolMessages);
  }

  throw new Error("agent_loop_limit");
}
