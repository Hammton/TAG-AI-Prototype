import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { isLlmEnabled } from "../config.js";
import { getStore } from "../data/index.js";
import { buildVehicleCapabilityContext } from "../domain/tools.js";
import { isCatalogExplorationQuestion } from "./intent.js";
import type { MessageRequest } from "../schemas/message.js";
import type { ActivityEmitter } from "./activity.js";
import { runAgent } from "./index.js";
import { classifyIntent } from "./intent.js";
import { streamArtifactNarrative, streamRecommendNarrative } from "./narrate.js";
import { emitTextAsTokens, streamAssistantText } from "./stream-text.js";
import { TAG_ASSISTANT_TONE } from "./tone.js";

const CLIENT_NAMES: Record<string, string> = {
  "CLI-UAE-MOD": "UAE Ministry of Defence",
  "CLI-AD-POLICE": "Abu Dhabi Police",
};

function clientLabel(clientId: string): string {
  return CLIENT_NAMES[clientId] ?? clientId;
}

async function enrichArtifactResult(
  kind: "spec" | "quote" | "engineering",
  result: unknown,
  req: MessageRequest,
): Promise<unknown> {
  if (!req.vehicle_model_id || kind === "quote") return result;

  const capability = await buildVehicleCapabilityContext({
    vehicle_model_id: req.vehicle_model_id,
    configuration_option_ids: req.configuration_option_ids ?? [],
    order_id: req.order_id,
  });

  if (kind === "spec") {
    const spec = (result as Record<string, unknown>) ?? {};
    const mission = (spec.mission_profile ?? {}) as Record<string, unknown>;
    const integ = (spec.integration_and_validation ?? {}) as Record<string, unknown>;
    const buildRefs = (spec.build_context_references ?? []) as string[];
    const srcRefs = (spec.source_references ?? []) as string[];

    return {
      ...spec,
      mission_profile: {
        primary_roles:
          (mission.primary_roles as string[] | undefined) ?? capability.mission_roles,
        protection_considerations:
          (mission.protection_considerations as string[] | undefined) ??
          capability.protection_profile,
        mobility_considerations:
          (mission.mobility_considerations as string[] | undefined) ??
          capability.mobility_profile,
        systems_and_payload:
          (mission.systems_and_payload as string[] | undefined) ??
          capability.systems_profile,
      },
      integration_and_validation: {
        integration_notes:
          (integ.integration_notes as string[] | undefined) ??
          capability.integration_profile,
        validation_checklist:
          (integ.validation_checklist as string[] | undefined) ?? [
            "Validate selected options against released BOM and drawing set",
            "Confirm ballistic/blast package conformance to approved profile",
            "Verify mobility package (suspension/brakes/run-flat) post-armoring baseline",
            "Cross-check compliance requirements against customer order notes",
            "Complete final engineering release review with manufacturing",
          ],
      },
      build_context_references:
        buildRefs.length > 0 ? buildRefs : capability.source_refs,
      source_references: srcRefs.length > 0 ? srcRefs : capability.source_refs,
    };
  }

  const engRoot = (result as Record<string, unknown>) ?? {};
  const pkg = ((engRoot.engineering_package ?? {}) as Record<string, unknown>) ?? {};
  return {
    ...engRoot,
    engineering_package: {
      ...pkg,
      manufacturing_work_packages:
        ((pkg.manufacturing_work_packages as unknown[]) ?? []).length > 0
          ? pkg.manufacturing_work_packages
          : [
              {
                package_id: "WP-CHASSIS-001",
                workstream: "Chassis and protection integration",
                scope:
                  "Install approved armor/protection package and verify structural interfaces.",
                dependencies: ["Approved option freeze", "BOM release"],
              },
              {
                package_id: "WP-SYSTEMS-002",
                workstream: "Mission systems and electrical integration",
                scope:
                  "Integrate comms/surveillance and validate electrical load and harness routing.",
                dependencies: ["System architecture review", "Power budget sign-off"],
              },
              {
                package_id: "WP-QA-003",
                workstream: "Validation and release",
                scope:
                  "Execute quality gates, compliance checks, and release readiness package.",
                dependencies: ["Assembly complete", "Verification tests complete"],
              },
            ],
      quality_and_verification_plan:
        ((pkg.quality_and_verification_plan as unknown[]) ?? []).length > 0
          ? pkg.quality_and_verification_plan
          : [
              {
                check: "Configuration conformance",
                method: "BOM and option matrix audit",
                acceptance: "All selected options installed and traceable",
              },
              {
                check: "Protection package validation",
                method: "Inspection against protection architecture checklist",
                acceptance: "No protection gaps or interface conflicts",
              },
              {
                check: "Mobility performance baseline",
                method: "Controlled route test",
                acceptance: "Vehicle meets handling and braking thresholds",
              },
              {
                check: "Electrical/mission systems health",
                method: "Power-on diagnostics and subsystem integration test",
                acceptance: "No critical faults",
              },
              {
                check: "Documentation release consistency",
                method: "Cross-check drawing set, BOM, and handover packet",
                acceptance: "Revision-consistent release package",
              },
            ],
      integration_interfaces:
        ((pkg.integration_interfaces as unknown[]) ?? []).length > 0
          ? pkg.integration_interfaces
          : capability.integration_profile.slice(0, 3).map((note, i) => ({
              system:
                i === 0
                  ? "Power and electrical"
                  : i === 1
                    ? "Mechanical and structural"
                    : "Mission systems",
              interface_note: note,
              risk: "Requires cross-discipline review before production release",
            })),
      safety_critical_notes:
        ((pkg.safety_critical_notes as string[]) ?? []).length > 0
          ? pkg.safety_critical_notes
          : capability.protection_profile,
      build_context_references:
        ((pkg.build_context_references as string[]) ?? []).length > 0
          ? pkg.build_context_references
          : capability.source_refs,
    },
  };
}

async function catalogContextBlock(): Promise<string> {
  const vehicles = await getStore().listVehicles();
  if (vehicles.length === 0) return "";
  const lines = vehicles.map((v) => `- ${v.model_code}: ${v.type}`).join("\n");
  return `\nTAG vehicle catalogue (use this list when the user asks about other types or options):\n${lines}\n`;
}

async function streamConversationalReply(
  req: MessageRequest,
  replySeed: string | undefined,
  emit: ActivityEmitter,
  mirrorThinking = false,
): Promise<string> {
  const who = clientLabel(req.client_id);
  const role =
    req.audience === "am"
      ? "Account Manager preparing packages for a client"
      : "Client representative exploring vehicle options";

  const lower = req.message.toLowerCase();
  const catalogBlock = isCatalogExplorationQuestion(lower)
    ? await catalogContextBlock()
    : "";

  if (catalogBlock) {
    emit({ type: "tool", tool: "list_vehicle_models", state: "done", message: "✓ list_vehicle_models (catalogue loaded)" });
  }

  const system = `${TAG_ASSISTANT_TONE}

You are the TAG Vehicle Systems configuration assistant (PoC).
The user is a ${role} working with ${who}.
Session: has_recommendation=${req.has_recommendation}, vehicle_selected=${req.has_vehicle_selected}${req.vehicle_code ? ` (${req.vehicle_code})` : ""}.

${replySeed ? `Guidance for this turn (use as direction, rewrite naturally): ${replySeed}` : ""}

Respond in prose only. Never output JSON. Do not claim you ran tools unless this message says tools already ran.
When information is missing for a recommendation, ask one focused follow-up question after acknowledging what you understood.
${catalogBlock}`;

  const history = req.history ?? [];
  const messages = [
    new SystemMessage(system),
    ...history.slice(-10).map((h) =>
      h.role === "user" ? new HumanMessage(h.content) : new AIMessage(h.content),
    ),
    new HumanMessage(req.message),
  ];

  if (!isLlmEnabled()) {
    const stub =
      replySeed?.trim() ||
      `What mission or vehicle requirement should we work on for **${who}**? For example: platform type, terrain, crew size, and protection level.`;
    return emitTextAsTokens(stub, emit);
  }

  try {
    return await streamAssistantText(messages, emit, {
      temperature: 0.45,
      mirrorThinking,
    });
  } catch {
    const fallback = replySeed ?? "How can I help with your vehicle configuration?";
    return emitTextAsTokens(fallback, emit);
  }
}

export async function streamUserMessage(
  req: MessageRequest,
  emit: ActivityEmitter,
): Promise<void> {
  const routed = await classifyIntent(
    {
      message: req.message,
      client_id: req.client_id,
      audience: req.audience,
      history: req.history,
      has_recommendation: req.has_recommendation,
      has_vehicle_selected: req.has_vehicle_selected,
      vehicle_code: req.vehicle_code,
    },
    emit,
  );

  emit({ type: "route", intent: routed.intent });
  emit({
    type: "thinking",
    message: `Routed → ${routed.intent}`,
  });

  if (
    routed.intent === "chat" ||
    routed.intent === "clarify" ||
    routed.intent === "client_blocked"
  ) {
    const reply = await streamConversationalReply(req, routed.reply, emit, true);
    emit({
      type: "message_done",
      reply,
      engine: routed.engine,
    });
    return;
  }

  if (routed.intent === "recommend") {
    const agentText = routed.agent_text ?? req.message;

    try {
      const out = await runAgent(
        {
          mode: "recommend",
          client_id: req.client_id,
          user_text: agentText,
        },
        emit,
      );

      const reply = await streamRecommendNarrative(
        out.result as Parameters<typeof streamRecommendNarrative>[0],
        {
          userMessage: req.message,
          audience: req.audience,
          clientLabel: clientLabel(req.client_id),
        },
        emit,
      );

      emit({
        type: "message_done",
        reply,
        recommendation: out.result,
        engine: out.engine,
        record_id: out.record_id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("insufficient_intent") || msg.includes("unknown_model")) {
        const reply = await streamConversationalReply(req, routed.reply ?? msg, emit);
        emit({ type: "message_done", reply, engine: routed.engine });
        return;
      }
      throw err;
    }
    return;
  }

  const kindByIntent = {
    generate_spec: "spec",
    generate_quote: "quote",
    generate_engineering: "engineering",
  } as const;

  const kind = kindByIntent[routed.intent as keyof typeof kindByIntent];
  if (kind) {
    if (!req.vehicle_model_id) {
      const reply = await streamConversationalReply(
        req,
        "Run a vehicle recommendation first so I know which platform to use for that document.",
        emit,
      );
      emit({ type: "message_done", reply, engine: routed.engine });
      return;
    }

    emit({ type: "phase", phase: "tools", message: `Generating ${kind}` });
    const mode =
      kind === "spec"
        ? "generate_spec"
        : kind === "quote"
          ? "generate_quote"
          : "generate_engineering_output";

    const out = await runAgent(
      {
        mode,
        order_id: req.order_id ?? "ORD-2026-POC",
        vehicle_model_id: req.vehicle_model_id,
        configuration_option_ids: req.configuration_option_ids ?? [],
        qty: req.qty ?? 1,
      },
      emit,
    );
    const enriched = await enrichArtifactResult(kind, out.result, req);

    const reply = await streamArtifactNarrative(
      kind,
      { vehicleCode: req.vehicle_code, audience: req.audience },
      emit,
    );

    emit({
      type: "message_done",
      reply,
      artifact_kind: kind,
      artifact_result: enriched,
      engine: out.engine,
      record_id: out.record_id,
    });
  }
}
