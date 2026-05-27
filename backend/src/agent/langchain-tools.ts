import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import * as domain from "../domain/tools.js";
import type { AgentRequest } from "../schemas/agent.js";

const ALL_TOOLS = [
  new DynamicStructuredTool({
    name: "search_past_orders",
    description:
      "Retrieve completed/delivered past orders for a given client and vehicle model. " +
      "Use to identify pricing history, configuration patterns, and similarity scores " +
      "to inform a recommendation. Returns order_id, date, qty, status, configuration_summary, " +
      "configuration_option_ids, unit_price_usd, and similarity_score.",
    schema: z.object({
      client_id: z.string().describe("The client's unique identifier, e.g. CLI-UAE-001"),
      vehicle_model_id: z.string().describe("The vehicle model ID, e.g. VEH-TUV-1200"),
      limit: z.number().int().positive().optional().describe("Max results to return (default 3)"),
    }),
    func: async (input) =>
      JSON.stringify(
        await domain.searchPastOrders(
          input.client_id,
          input.vehicle_model_id,
          input.limit,
        ),
      ),
  }),
  new DynamicStructuredTool({
    name: "get_vehicle_model",
    description:
      "Fetch the vehicle model record: model_code, type, base_price_usd, and lead_time_days. " +
      "Always call this before generating any spec or quote — never assume the base price.",
    schema: z.object({
      vehicle_model_id: z.string().describe("The vehicle model ID, e.g. VEH-TUV-1200"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.getVehicleModel(input.vehicle_model_id)),
  }),
  new DynamicStructuredTool({
    name: "list_vehicle_models",
    description:
      "List all vehicle models in the TAG catalogue. Use this when the user describes an operational need " +
      "but has not selected a vehicle_model_id yet. Returns id, model_code, type, base_price_usd, and lead_time_days.",
    schema: z.object({}),
    func: async () => JSON.stringify(await domain.listVehicleModels()),
  }),
  new DynamicStructuredTool({
    name: "recommend_from_client_intent",
    description:
      "Create a workflow-native recommendation from a client's natural-language requirement. " +
      "Use when recommend mode includes user_text or opportunity_note, especially when vehicle_model_id is missing. " +
      "It selects the best vehicle model, searches same-client history, and returns recommended_vehicle, " +
      "recommended_configuration, recommendations, has_history, and next_actions.",
    schema: z.object({
      client_id: z.string().describe("The client's unique identifier"),
      user_text: z.string().optional().describe("Raw client or account-manager requirement text"),
      opportunity_note: z.string().optional().describe("Optional opportunity note from the workflow"),
      vehicle_model_id: z.string().optional().describe("Vehicle model ID if already selected"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.recommendFromClientIntent(input)),
  }),
  new DynamicStructuredTool({
    name: "get_configuration_options",
    description:
      "Return all available configuration options for a vehicle model, grouped by category " +
      "(e.g. Drivetrain, Protection, Comms). Each option includes id, name, and add_on_price_usd. " +
      "Use to build the configuration table in a spec document.",
    schema: z.object({
      vehicle_model_id: z.string().describe("The vehicle model ID"),
    }),
    func: async (input) =>
      JSON.stringify(
        await domain.getConfigurationOptions(input.vehicle_model_id),
      ),
  }),
  new DynamicStructuredTool({
    name: "get_custom_requirements",
    description:
      "Fetch the client's custom requirements for a specific order: delivery terms (e.g. FOB Abu Dhabi), " +
      "compliance standards (e.g. MIL-STD-461G), and build notes (e.g. RAL paint codes). " +
      "Always call this when order_id is available in generate_spec mode.",
    schema: z.object({
      order_id: z.string().describe("The order ID, e.g. ORD-2026-POC"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.getCustomRequirements(input.order_id)),
  }),
  new DynamicStructuredTool({
    name: "calculate_quote_line_items",
    description:
      "AUTHORITATIVE pricing calculator. Always call this first in generate_quote mode. " +
      "Returns: base_price, options_subtotal, unit_price, qty, subtotal, total_usd, lead_time_days. " +
      "NEVER compute or estimate prices yourself — only use the values this tool returns.",
    schema: z.object({
      vehicle_model_id: z.string().describe("The vehicle model ID"),
      configuration_option_ids: z
        .array(z.string())
        .describe("Array of selected option IDs, e.g. ['opt-4wd', 'opt-level3']"),
      qty: z.number().int().positive().describe("Order quantity"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.calculateQuoteLineItems(input)),
  }),
  new DynamicStructuredTool({
    name: "search_build_context",
    description:
      "Keyword search across build-book document chunks for a vehicle model. " +
      "Returns relevant text excerpts about manufacturing specs, tolerances, certifications, or processes. " +
      "Use in generate_spec mode to populate build_context_references.",
    schema: z.object({
      query: z.string().describe("Search keyword or phrase, e.g. 'suspension' or 'armour plate'"),
      vehicle_model_id: z.string().describe("The vehicle model ID"),
      limit: z.number().int().positive().optional().describe("Max chunks to return (default 3)"),
    }),
    func: async (input) =>
      JSON.stringify(
        await domain.searchBuildContext(
          input.query,
          input.vehicle_model_id,
          input.limit,
        ),
      ),
  }),
  new DynamicStructuredTool({
    name: "get_cad_metadata",
    description:
      "Retrieve CAD/engineering metadata for a vehicle model: bom_reference, drawing_set_reference, " +
      "weight_kg, length_mm, width_mm, height_mm. Use in generate_spec to populate technical_data.",
    schema: z.object({
      vehicle_model_id: z.string().describe("The vehicle model ID"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.getCadMetadata(input.vehicle_model_id)),
  }),
  new DynamicStructuredTool({
    name: "build_vehicle_capability_context",
    description:
      "Build a structured capability context for specification and engineering outputs. " +
      "Returns mission_roles, protection_profile, mobility_profile, systems_profile, " +
      "integration_profile, selected_options, and source_refs curated from TAG vehicle " +
      "capability references and selected configuration data.",
    schema: z.object({
      vehicle_model_id: z.string().describe("The vehicle model ID"),
      configuration_option_ids: z
        .array(z.string())
        .optional()
        .describe("Selected option IDs (optional but recommended)"),
      order_id: z
        .string()
        .optional()
        .describe("Order ID if custom requirements should be included"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.buildVehicleCapabilityContext(input)),
  }),
  new DynamicStructuredTool({
    name: "generate_engineering_package",
    description:
      "Build the final engineering handover package after client approval. " +
      "Uses vehicle data, selected configuration options, custom requirements, CAD metadata, " +
      "and build-book context. Returns engineering_package with BOM, drawing refs, " +
      "configuration requirements, compliance requirements, custom notes, and handover_status.",
    schema: z.object({
      order_id: z.string().describe("The approved order ID, e.g. ORD-2026-POC"),
      vehicle_model_id: z.string().describe("The vehicle model ID"),
      configuration_option_ids: z
        .array(z.string())
        .describe("Selected approved configuration option IDs"),
    }),
    func: async (input) =>
      JSON.stringify(await domain.generateEngineeringOutput(input)),
  }),
];

const TOOLS_BY_MODE: Record<AgentRequest["mode"], string[]> = {
  recommend: [
    "recommend_from_client_intent",
    "list_vehicle_models",
    "search_past_orders",
    "get_vehicle_model",
    "get_configuration_options",
  ],
  generate_spec: [
    "get_vehicle_model",
    "get_configuration_options",
    "get_custom_requirements",
    "search_build_context",
    "get_cad_metadata",
    "build_vehicle_capability_context",
  ],
  generate_quote: [
    "calculate_quote_line_items",
    "get_vehicle_model",
    "get_configuration_options",
  ],
  generate_engineering_output: [
    "generate_engineering_package",
    "build_vehicle_capability_context",
  ],
};

export function getToolsForMode(mode: AgentRequest["mode"]) {
  const allowed = new Set(TOOLS_BY_MODE[mode]);
  return ALL_TOOLS.filter((t) => allowed.has(t.name));
}
