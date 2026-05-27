import { isLlmEnabled } from "../config.js";
import { persistAgentOutput } from "../domain/tools.js";
import type { AgentRequest } from "../schemas/agent.js";
import type { ActivityEmitter } from "./activity.js";
import { runLangChainAgent } from "./runner.js";
import { runStubAgent } from "./stub.js";

export async function runAgent(
  req: AgentRequest,
  onActivity?: ActivityEmitter,
): Promise<{
  result: unknown;
  engine: "langchain" | "stub";
  record_id: string | null;
}> {
  const result = isLlmEnabled()
    ? await runLangChainAgent(req, onActivity)
    : await runStubAgent(req, onActivity);

  const engine = isLlmEnabled() ? "langchain" : "stub";

  onActivity?.({
    type: "phase",
    phase: "persist",
    message: "Saving output to the order record",
  });
  const record_id = await persistAgentOutput(req.mode, req.order_id, result);

  return { result, engine, record_id };
}
