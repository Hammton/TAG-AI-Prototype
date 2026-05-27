import * as domain from "../domain/tools.js";
import type { AgentRequest } from "../schemas/agent.js";
import { emitToolActivity, type ActivityEmitter } from "./activity.js";

async function runTool<T>(
  emit: ActivityEmitter | undefined,
  tool: string,
  args: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  emitToolActivity(emit, tool, "start", args);
  try {
    const result = await fn();
    emitToolActivity(emit, tool, "done", args);
    return result;
  } catch (err) {
    emitToolActivity(emit, tool, "error", args);
    throw err;
  }
}

export async function runStubAgent(
  req: AgentRequest,
  onActivity?: ActivityEmitter,
): Promise<unknown> {
  onActivity?.({
    type: "thinking",
    message: `stub · mode: ${req.mode}`,
  });

  if (req.mode === "recommend") {
    if (!req.vehicle_model_id) {
      const args = {
        client_id: req.client_id!,
        user_text: req.user_text,
        opportunity_note: req.opportunity_note,
      };
      return runTool(onActivity, "recommend_from_client_intent", args, () =>
        domain.recommendFromClientIntent(args),
      );
    }

    const searchArgs = { client_id: req.client_id!, vehicle_model_id: req.vehicle_model_id! };
    const rows = await runTool(onActivity, "search_past_orders", searchArgs, () =>
      domain.searchPastOrders(req.client_id!, req.vehicle_model_id!),
    );
    const recArgs = {
      client_id: req.client_id!,
      vehicle_model_id: req.vehicle_model_id!,
      user_text: req.user_text,
      opportunity_note: req.opportunity_note,
    };
    const recommendation = await runTool(
      onActivity,
      "recommend_from_client_intent",
      recArgs,
      () => domain.recommendFromClientIntent(recArgs),
    );
    return {
      ...recommendation,
      recommendations: rows.map((o, i) => ({
        order_id: o.order_id,
        rank: i + 1,
        match_reason: "Past delivered order for same client and model",
        configuration_summary: o.configuration_summary,
        configuration_option_ids: o.configuration_option_ids,
        unit_price_usd: o.unit_price_usd,
        date: o.date,
      })),
      has_history: rows.length > 0,
    };
  }

  if (req.mode === "generate_quote") {
    const args = {
      vehicle_model_id: req.vehicle_model_id!,
      configuration_option_ids: req.configuration_option_ids!,
      qty: req.qty!,
    };
    const quote = await runTool(onActivity, "calculate_quote_line_items", args, () =>
      domain.calculateQuoteLineItems(args),
    );

    return {
      quote_reference: `QUO-POC-${Date.now()}`,
      line_items: [
        {
          description: "Configured vehicle unit",
          unit_price_usd: quote.unit_price,
          qty: quote.qty,
          total_usd: quote.subtotal,
        },
      ],
      subtotal_usd: quote.subtotal,
      total_usd: quote.total_usd,
      lead_time_days: quote.lead_time_days,
      payment_terms: "30% deposit, 70% on delivery",
      notes: "Deterministic pricing — stub mode",
    };
  }

  if (req.mode === "generate_engineering_output") {
    const args = {
      order_id: req.order_id!,
      vehicle_model_id: req.vehicle_model_id!,
      configuration_option_ids: req.configuration_option_ids!,
    };
    return runTool(onActivity, "generate_engineering_package", args, () =>
      domain.generateEngineeringOutput(args),
    );
  }

  const vehicleArgs = { vehicle_model_id: req.vehicle_model_id! };
  const vehicle = await runTool(onActivity, "get_vehicle_model", vehicleArgs, () =>
    domain.getVehicleModel(req.vehicle_model_id!),
  );
  const optionIds = req.configuration_option_ids ?? [];
  const configOptions = await runTool(
    onActivity,
    "get_configuration_options",
    vehicleArgs,
    () => domain.getConfigurationOptions(req.vehicle_model_id!),
  );
  const custom = req.order_id
    ? await runTool(
        onActivity,
        "get_custom_requirements",
        { order_id: req.order_id },
        () => domain.getCustomRequirements(req.order_id!),
      )
    : { delivery: null, compliance: null, notes: null };
  const cad = await runTool(onActivity, "get_cad_metadata", vehicleArgs, () =>
    domain.getCadMetadata(req.vehicle_model_id!),
  );
  const capArgs = {
    vehicle_model_id: req.vehicle_model_id!,
    configuration_option_ids: optionIds,
    order_id: req.order_id,
  };
  const capability = await runTool(
    onActivity,
    "build_vehicle_capability_context",
    capArgs,
    () => domain.buildVehicleCapabilityContext(capArgs),
  );

  const configuration = optionIds.map((id) => {
    const opt = Object.values(configOptions.categories)
      .flat()
      .find((o) => o.id === id);
    return {
      category: "Configuration",
      option: opt?.name ?? id,
      spec_detail: `Option ${id}`,
    };
  });

  return {
    spec_version: "1.0",
    generated_at: new Date().toISOString(),
    vehicle: {
      model_code: vehicle?.model_code,
      type: vehicle?.type,
      base_model_code: vehicle?.model_code,
      image_url: vehicle?.image_url ?? null,
    },
    configuration,
    custom_requirements: custom,
    technical_data: cad ?? {},
    mission_profile: {
      primary_roles: capability.mission_roles,
      protection_considerations: capability.protection_profile,
      mobility_considerations: capability.mobility_profile,
      systems_and_payload: capability.systems_profile,
    },
    integration_and_validation: {
      integration_notes: capability.integration_profile,
      validation_checklist: [
        "Validate all selected options are reflected in final configuration release",
        "Cross-check CAD metadata references against released BOM and drawing set",
        "Confirm compliance and delivery requirements are reflected in build instructions",
        "Execute protection and mobility acceptance checks before handover",
        "Issue signed engineering release package for production kickoff",
      ],
    },
    build_context_references: capability.source_refs,
    source_references: capability.source_refs,
  };
}
