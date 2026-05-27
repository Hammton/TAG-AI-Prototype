import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isLlmEnabled } from "../config.js";
import type { ChatRequest } from "../schemas/chat.js";
import { createChatModel } from "./llm.js";

const CLIENT_NAMES: Record<string, string> = {
  "CLI-UAE-MOD": "UAE Ministry of Defence",
  "CLI-AD-POLICE": "Abu Dhabi Police",
};

function clientLabel(clientId?: string): string {
  if (!clientId) return "your organisation";
  return CLIENT_NAMES[clientId] ?? clientId;
}

function stubChatReply(req: ChatRequest): string {
  const who = clientLabel(req.client_id);
  const msg = req.message.trim().toLowerCase();

  if (/^(hi|hello|hey|hiya|howdy|good\s)/.test(msg)) {
    if (req.audience === "am") {
      return `Hello. I'm the TAG configuration assistant for **${who}**. Describe the client's mission or vehicle need and I'll recommend a platform and past configurations. When you're ready, I can draft spec, quote, and engineering packages.`;
    }
    return `Hello. I'm here to help **${who}** find the right TAG vehicle. Tell me about your mission — type of vehicle, crew size, terrain, and protection level — and I'll suggest a match you can submit as an order request.`;
  }

  if (/thank/.test(msg)) {
    return "You're welcome. Let me know when you'd like to continue with a vehicle recommendation or configuration.";
  }

  if (req.audience === "am") {
    return `I'm focused on vehicle configuration for **${who}**. Share the client requirement (e.g. APC for tactical response, desert utility fleet, protection level) and I'll run a recommendation — or ask me to generate a spec, quote, or engineering output once a vehicle is selected.`;
  }

  return `To recommend a vehicle for **${who}**, describe what you need — for example armored personnel carrier, troop capacity, terrain, and protection level. I won't guess from a short message; the more context you give, the better the match.`;
}

function buildChatSystemPrompt(req: ChatRequest): string {
  const who = clientLabel(req.client_id);
  const role =
    req.audience === "am"
      ? "Account Manager preparing packages for a client"
      : "Client representative exploring vehicle options";

  return `You are the TAG Vehicle Systems configuration assistant (PoC).
The user is a ${role} working with ${who}.

Respond in natural, concise prose (2–4 short paragraphs max). Use markdown sparingly (**bold** for emphasis only).
Do NOT invent vehicle models, prices, or specifications.
Do NOT claim you have already matched or recommended a vehicle unless the user described a clear mission requirement.
For greetings or vague messages, welcome them and ask what mission or vehicle need they want to explore.
For Account Managers: mention you can recommend from client intent, then generate spec, quote, and engineering outputs.
For Clients: mention they can get a recommendation and submit an order request; specs and quotes are prepared by their Account Manager.
Never output JSON.`;
}

export async function runChat(req: ChatRequest): Promise<{
  reply: string;
  engine: "langchain" | "stub";
}> {
  if (!isLlmEnabled()) {
    return { reply: stubChatReply(req), engine: "stub" };
  }

  const llm = createChatModel({ temperature: 0.45 });
  const history = req.history ?? [];
  const messages = [
    new SystemMessage(buildChatSystemPrompt(req)),
    ...history.slice(-8).map((h) =>
      h.role === "user"
        ? new HumanMessage(h.content)
        : new AIMessage(h.content),
    ),
    new HumanMessage(req.message),
  ];

  const response = await llm.invoke(messages);
  const content =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .map((p) => (typeof p === "string" ? p : ("text" in p ? p.text : "")))
            .join("")
        : "";

  const reply = content.trim() || stubChatReply(req);
  return { reply, engine: "langchain" };
}
