import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isLlmEnabled } from "../config.js";
import type { ActivityEmitter } from "./activity.js";
import { emitTextAsTokens, streamAssistantText } from "./stream-text.js";
import { TAG_ASSISTANT_TONE } from "./tone.js";

type RecommendResult = {
  recommended_vehicle: {
    model_code: string;
    type: string;
    reason: string;
  };
};

export async function streamRecommendNarrative(
  result: RecommendResult,
  ctx: {
    userMessage: string;
    audience: "client" | "am";
    clientLabel: string;
  },
  emit: ActivityEmitter,
): Promise<string> {
  const v = result.recommended_vehicle;
  const stub = buildStubRecommendNarrative(result, ctx);

  if (!isLlmEnabled()) {
    return emitTextAsTokens(stub, emit);
  }

  const system = `${TAG_ASSISTANT_TONE}

You are the TAG Vehicle Configuration assistant. The recommendation tools have already run.
Explain the match to the user in natural prose (2–3 short paragraphs max).
Mention ${v.model_code} (${v.type}) and why it fits. Reference the user's request.
${ctx.audience === "client" ? "Invite them to open the recommendation panel and submit an order when ready." : "Invite them to review past orders in the panel, then generate spec, quote, or engineering as needed."}
Do not use bullet lists.`;

  const user = `User message: ${ctx.userMessage}

Tool result:
${JSON.stringify(result, null, 2)}`;

  try {
    return await streamAssistantText(
      [new SystemMessage(system), new HumanMessage(user)],
      emit,
      { temperature: 0.4 },
    );
  } catch {
    return emitTextAsTokens(stub, emit);
  }
}

function buildStubRecommendNarrative(
  result: RecommendResult,
  ctx: { userMessage: string; audience: "client" | "am" },
): string {
  const v = result.recommended_vehicle;
  const asked = ctx.userMessage.toLowerCase();
  const namedIfv = /\bifv\b|infantry fighting/.test(asked);
  const namedApc = /\bapc\b|personnel carrier/.test(asked);
  const namedModel = v.model_code.toLowerCase().replace(/-/g, "");
  const askedThisModel = asked.replace(/[\s-_]/g, "").includes(namedModel);

  let opener: string;
  if (askedThisModel) {
    opener = `Here is **${v.model_code}** (${v.type}) from the TAG catalogue.`;
  } else if (namedIfv && v.model_code.includes("IFV")) {
    opener = `For an infantry fighting vehicle requirement, **${v.model_code}** (${v.type}) is the closest match in our catalogue.`;
  } else if (namedIfv && !v.model_code.includes("IFV")) {
    opener = `You asked about an IFV; our catalogue lists **${v.model_code}** (${v.type}) as the nearest platform for this mission — I have not substituted an APC without flagging that.`;
  } else if (namedApc) {
    opener = `For an APC requirement, **${v.model_code}** (${v.type}) is the best fit in the catalogue.`;
  } else {
    opener = `Based on what you described, **${v.model_code}** (${v.type}) is the strongest match.`;
  }

  const reason = v.reason ? ` ${v.reason}` : "";
  const next =
    ctx.audience === "client"
      ? " Open the recommendation on the right when you want to review configuration options or submit an order request."
      : " I have opened the recommendation — review past orders there, then say if you want a spec, quote, or engineering package.";

  return `${opener}${reason}${next}`;
}

export async function streamArtifactNarrative(
  kind: "spec" | "quote" | "engineering",
  ctx: { vehicleCode?: string; audience: "client" | "am" },
  emit: ActivityEmitter,
): Promise<string> {
  const labels = {
    spec: "specification",
    quote: "commercial quote",
    engineering: "engineering handover package",
  };
  const stub = `Your ${labels[kind]} for **${ctx.vehicleCode ?? "this vehicle"}** is ready — I have opened it in the panel on the right.${ctx.audience === "am" ? " Review and approve when you are happy with it." : ""}`;

  if (!isLlmEnabled()) {
    return emitTextAsTokens(stub, emit);
  }

  const system = `${TAG_ASSISTANT_TONE}
Briefly tell the user their ${labels[kind]} document is ready. One short paragraph. No bullet lists.`;

  try {
    return await streamAssistantText(
      [new SystemMessage(system), new HumanMessage(`Vehicle: ${ctx.vehicleCode ?? "selected"}`)],
      emit,
      { temperature: 0.35 },
    );
  } catch {
    return emitTextAsTokens(stub, emit);
  }
}
