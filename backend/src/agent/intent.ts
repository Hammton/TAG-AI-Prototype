import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isLlmEnabled } from "../config.js";
import type { IntentRequest, IntentResult, IntentType } from "../schemas/intent.js";
import { intentResultSchema } from "../schemas/intent.js";
import { hasMeaningfulVehicleIntent } from "../domain/tools.js";
import type { ActivityEmitter } from "./activity.js";
import { createChatModel } from "./llm.js";
import {
  LiveThinking,
  chunkText,
  shouldSurfaceAsThinking,
} from "./live-thinking.js";

const CLIENT_NAMES: Record<string, string> = {
  "CLI-UAE-MOD": "UAE Ministry of Defence",
  "CLI-AD-POLICE": "Abu Dhabi Police",
};

function clientLabel(clientId?: string): string {
  if (!clientId) return "the client";
  return CLIENT_NAMES[clientId] ?? clientId;
}

function parseJsonFromContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(raw);
}

function buildIntentSystemPrompt(req: IntentRequest): string {
  const who = clientLabel(req.client_id);
  return `You classify user intent for the TAG Vehicle Configuration Agent.

Audience: ${req.audience === "am" ? "Account Manager" : "Client"} (${who})
Session: has_recommendation=${req.has_recommendation}, has_vehicle_selected=${req.has_vehicle_selected}${req.vehicle_code ? `, vehicle=${req.vehicle_code}` : ""}

Return ONLY valid JSON (no markdown):
{
  "intent": "chat" | "clarify" | "recommend" | "generate_spec" | "generate_quote" | "generate_engineering" | "client_blocked",
  "reply": "string — required for chat, clarify, and client_blocked: natural conversational response",
  "agent_text": "string — required for recommend: full mission/requirement text for the recommend agent (merge thread context if user is continuing a discussion)"
}

Rules:
- Understand meaning from the full conversation, not single keywords.
- chat: greetings, thanks, general questions, capability asks, opinions, comparisons.
- clarify: user named a model or mission that needs one more detail before tools run, OR asked for a platform type that should not be confused with another (IFV vs APC), OR "show me X" where X needs confirmation.
- recommend: user describes or refines a vehicle/mission need (type, terrain, protection, fleet, use case) — including follow-ups that add detail to an earlier mission.
- generate_spec | generate_quote | generate_engineering: AM explicitly asks to create/draft that deliverable AND a vehicle is already selected/recommended.
- client_blocked: Client asks for spec, quote, or engineering package (AM-only in this PoC). reply explains AM will prepare those after order.
- Do NOT recommend on greetings alone.
- Do NOT recommend on "yes"/"ok" unless they clearly mean "run recommendation now" with enough context in the thread.
- If user asks both a question and states a need, prefer recommend and put the mission in agent_text.
- reply must be helpful prose (not JSON). agent_text should be standalone (no "as mentioned above").`;
}

function combinedUserContext(req: IntentRequest): string {
  const parts = [...(req.history ?? []), { role: "user" as const, content: req.message }]
    .filter((h) => h.role === "user")
    .slice(-4)
    .map((h) => h.content.trim())
    .filter(Boolean);
  return parts.join("\n");
}

/** Follow-up questions about alternatives — not a new recommendation run. */
export function isCatalogExplorationQuestion(lower: string): boolean {
  return (
    /\b(what (?:are|is)|which|other|another|different|alternative|else)\b/.test(
      lower,
    ) &&
    /\b(vehicle|type|option|platform|model|catalogue|catalog)\b/.test(lower)
  );
}

function stubClassifyIntent(req: IntentRequest): IntentResult {
  const msg = req.message.trim();
  const lower = msg.toLowerCase();
  const thread = combinedUserContext(req);
  const threadLower = thread.toLowerCase();
  const who = clientLabel(req.client_id);

  if (isCatalogExplorationQuestion(lower)) {
    return {
      intent: "chat",
      engine: isLlmEnabled() ? "langchain" : "stub",
    };
  }

  const wantsSpec = /\b(spec|specification)\b/.test(lower);
  const wantsQuote = /\b(quote|pricing|price)\b/.test(lower);
  const wantsEng =
    /\b(engineering|handover|bom|drawing)\b/.test(lower) ||
    lower.includes("engineering output");
  const wantsRecommend =
    /\b(recommend|suggest|find (?:us |me )?a vehicle|match|what vehicle)\b/.test(lower) ||
    hasMeaningfulVehicleIntent(threadLower);

  if (req.audience === "client" && (wantsSpec || wantsQuote || wantsEng)) {
    return {
      intent: "client_blocked",
      reply:
        "Your Account Manager will prepare the specification, commercial quote, and engineering package after you submit an order request. I can help you find the right vehicle and configuration first.",
      engine: "stub",
    };
  }

  if (req.audience === "am" && req.has_vehicle_selected) {
    if (wantsSpec)
      return { intent: "generate_spec", engine: "stub" };
    if (wantsQuote)
      return { intent: "generate_quote", engine: "stub" };
    if (wantsEng)
      return { intent: "generate_engineering", engine: "stub" };
  }

  if (wantsRecommend || (hasMeaningfulVehicleIntent(lower) && !isQuestionOnly(lower))) {
    return {
      intent: "recommend",
      agent_text: thread.length > msg.length ? thread : msg,
      engine: "stub",
    };
  }

  if (isGreetingOrSocial(lower) || isQuestionOnly(lower) || isTooVague(lower, threadLower)) {
    return {
      intent: "chat",
      reply: stubChatReply(req, lower),
      engine: "stub",
    };
  }

  if (hasMeaningfulVehicleIntent(threadLower)) {
    return {
      intent: "recommend",
      agent_text: thread,
      engine: "stub",
    };
  }

  return {
    intent: "chat",
    reply: stubChatReply(req, lower),
    engine: "stub",
  };
}

function isGreetingOrSocial(lower: string): boolean {
  return /^(hi|hello|hey|hiya|howdy|good\s+(morning|afternoon|evening)|thanks|thank you|ok|okay|cool|great|bye)[\s!.?,]*$/i.test(
    lower,
  );
}

function isQuestionOnly(lower: string): boolean {
  if (isCatalogExplorationQuestion(lower)) return true;
  if (!lower.includes("?") && !/^(what|how|why|when|where|who|can you|could you|do you|tell me|explain)\b/.test(lower)) {
    return false;
  }
  return !hasMeaningfulVehicleIntent(lower);
}

function isTooVague(messageLower: string, threadLower: string): boolean {
  if (messageLower.length > 80) return false;
  if (hasMeaningfulVehicleIntent(messageLower)) return false;
  if (hasMeaningfulVehicleIntent(threadLower) && messageLower.length < 40) {
    return /\b(yes|yeah|yep|ok|okay|sure|go ahead|sounds good|do it|please)\b/.test(messageLower);
  }
  return messageLower.length < 28 && !hasMeaningfulVehicleIntent(threadLower);
}

function stubChatReply(req: IntentRequest, lower: string): string {
  const who = clientLabel(req.client_id);
  if (isGreetingOrSocial(lower)) {
    if (req.audience === "am") {
      return `Hello. I'm working with **${who}**. Tell me the client's mission or vehicle requirement and I'll recommend a platform — or ask me to draft spec, quote, or engineering once we've selected a configuration.`;
    }
    return `Hello. I can help **${who}** find the right TAG vehicle. Describe your mission — vehicle type, crew, terrain, protection level — and I'll recommend a match.`;
  }
  if (req.has_recommendation) {
    return "I've already prepared a recommendation in the panel on the right. You can adjust the configuration, submit an order request, or ask me to explain any part of the match.";
  }
  return `What vehicle or mission requirement should we work on for **${who}**? For example: armored personnel carrier for tactical response, desert utility fleet, or VIP protection with Level III.`;
}

function explicitGenerationIntent(req: IntentRequest): IntentResult | null {
  const lower = req.message.trim().toLowerCase();
  const asksSpec = /\b(generate|create|draft|prepare|build)?\s*\b(spec|specification)\b/.test(
    lower,
  );
  const asksQuote = /\b(generate|create|draft|prepare|build)?\s*\b(quote|pricing)\b/.test(
    lower,
  );
  const asksEngineering =
    /\b(generate|create|draft|prepare|build)?\s*\b(engineering|handover)\b/.test(
      lower,
    ) || lower.includes("engineering output");

  if (!asksSpec && !asksQuote && !asksEngineering) return null;

  if (req.audience === "client") {
    return {
      intent: "client_blocked",
      reply:
        "Specifications, quotes, and engineering outputs are prepared by your Account Manager after order submission.",
      engine: "stub",
    };
  }

  if (!req.has_vehicle_selected) {
    return {
      intent: "chat",
      reply:
        "I can generate that document as soon as a vehicle is selected. Start with a recommendation, then ask me to generate the document.",
      engine: "stub",
    };
  }

  if (asksSpec) return { intent: "generate_spec", engine: "stub" };
  if (asksQuote) return { intent: "generate_quote", engine: "stub" };
  return { intent: "generate_engineering", engine: "stub" };
}

const FAST_ROUTE_INTENTS = new Set<IntentType>([
  "recommend",
  "client_blocked",
  "generate_spec",
  "generate_quote",
  "generate_engineering",
]);

/** Skip slow LLM routing when rules already yield a clear operational intent. */
function tryFastRoute(req: IntentRequest): IntentResult | null {
  const lower = req.message.toLowerCase();
  if (isCatalogExplorationQuestion(lower)) return null;

  const thread = combinedUserContext(req).toLowerCase();
  if (!hasMeaningfulVehicleIntent(thread)) return null;

  const stub = stubClassifyIntent(req);
  if (!FAST_ROUTE_INTENTS.has(stub.intent)) return null;

  return {
    ...stub,
    engine: isLlmEnabled() ? "langchain" : "stub",
  };
}

export async function classifyIntent(
  req: IntentRequest,
  onActivity?: ActivityEmitter,
): Promise<IntentResult> {
  onActivity?.({
    type: "thinking",
    message: `“${req.message.trim().slice(0, 80)}${req.message.length > 80 ? "…" : ""}”`,
    live: true,
  });

  const override = explicitGenerationIntent(req);
  if (override) return override;

  if (isCatalogExplorationQuestion(req.message.toLowerCase())) {
    onActivity?.({
      type: "thinking",
      message: "Route: chat (catalog / alternatives question)",
    });
    return stubClassifyIntent(req);
  }

  if (!isLlmEnabled()) {
    return stubClassifyIntent(req);
  }

  const fast = tryFastRoute(req);
  if (fast) {
    onActivity?.({
      type: "thinking",
      message: `Route: ${fast.intent} (matched mission keywords)`,
    });
    return fast;
  }

  const llm = createChatModel({ temperature: 0.15 });
  const history = req.history ?? [];
  const historyBlock =
    history.length > 0
      ? `\n\nConversation:\n${history
          .slice(-10)
          .map((h) => `${h.role}: ${h.content}`)
          .join("\n")}`
      : "";

  const live = new LiveThinking(onActivity);
  let content = "";

  try {
    const stream = await llm.stream([
      new SystemMessage(buildIntentSystemPrompt(req)),
      new HumanMessage(`Latest user message:\n${req.message}${historyBlock}`),
    ]);
    for await (const chunk of stream) {
      const text = chunkText(chunk.content);
      content += text;
      if (text.trim()) {
        live.push(
          shouldSurfaceAsThinking(text)
            ? text
            : text.trim().slice(0, 160),
        );
      }
    }
    live.finalize();
  } catch {
    return stubClassifyIntent(req);
  }

  try {
    const raw = parseJsonFromContent(content);
    const parsed = intentResultSchema.parse({
      ...(typeof raw === "object" && raw !== null ? raw : {}),
      engine: "langchain",
    });
    return normalizeIntent(parsed, req);
  } catch {
    return stubClassifyIntent(req);
  }
}

function normalizeIntent(result: IntentResult, req: IntentRequest): IntentResult {
  const intent = result.intent;

  if (intent === "chat" || intent === "clarify" || intent === "client_blocked") {
    return {
      intent,
      reply: result.reply?.trim() || stubChatReply(req, req.message.toLowerCase()),
      engine: result.engine,
    };
  }

  if (intent === "recommend") {
    const agent_text =
      result.agent_text?.trim() ||
      (hasMeaningfulVehicleIntent(combinedUserContext(req))
        ? combinedUserContext(req)
        : undefined);
    if (!agent_text || !hasMeaningfulVehicleIntent(agent_text.toLowerCase())) {
      return {
        intent: "chat",
        reply:
          result.reply?.trim() ||
          stubChatReply(req, req.message.toLowerCase()),
        engine: result.engine,
      };
    }
    return { intent: "recommend", agent_text, engine: result.engine };
  }

  const genIntents: IntentType[] = [
    "generate_spec",
    "generate_quote",
    "generate_engineering",
  ];
  if (genIntents.includes(intent)) {
    if (req.audience === "client") {
      return {
        intent: "client_blocked",
        reply:
          result.reply ??
          "Specifications, quotes, and engineering outputs are prepared by your Account Manager.",
        engine: result.engine,
      };
    }
    if (!req.has_vehicle_selected) {
      return {
        intent: "chat",
        reply:
          "Run a vehicle recommendation first so I know which platform to use for that document.",
        engine: result.engine,
      };
    }
    return { intent, engine: result.engine };
  }

  return stubClassifyIntent(req);
}
