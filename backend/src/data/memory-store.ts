import type { DataStore } from "./types.js";
import {
  buildBookChunks,
  cadMetadata,
  clients,
  customRequirements,
  options,
  pastOrders,
  vehicles,
} from "../fixtures.js";

export const memoryStore: DataStore = {
  async listClients() {
    return clients;
  },

  async listVehicles() {
    return vehicles;
  },

  async listOptions(vehicle_model_id: string) {
    return options.filter((o) => o.vehicle_model_id === vehicle_model_id);
  },

  async searchPastOrders(client_id, vehicle_model_id, limit = 3) {
    return pastOrders
      .filter(
        (o) =>
          o.client_id === client_id && o.vehicle_model_id === vehicle_model_id,
      )
      .slice(0, limit)
      .map((o, index) => ({
        order_id: o.order_id,
        date: o.date,
        qty: o.qty,
        status: o.status,
        configuration_summary: o.configuration_summary,
        configuration_option_ids: o.configuration_option_ids,
        unit_price_usd: o.unit_price_usd,
        similarity_score: Math.max(0.5, 1 - index * 0.05),
      }));
  },

  async getVehicleModel(vehicle_model_id) {
    return vehicles.find((v) => v.id === vehicle_model_id) ?? null;
  },

  async getConfigurationOptions(vehicle_model_id) {
    const rows = await this.listOptions(vehicle_model_id);
    const categories: Record<
      string,
      Array<{ id: string; name: string; add_on_price: number }>
    > = {};
    for (const row of rows) {
      if (!categories[row.category]) categories[row.category] = [];
      categories[row.category].push({
        id: row.id,
        name: row.name,
        add_on_price: row.add_on_price_usd,
      });
    }
    return { categories };
  },

  async getCustomRequirements(order_id) {
    const row = customRequirements[order_id];
    return row
      ? { delivery: row.delivery, compliance: row.compliance, notes: row.notes }
      : { delivery: null, compliance: null, notes: null };
  },

  async searchBuildContext(query, vehicle_model_id, limit = 3) {
    const q = query.toLowerCase();
    return buildBookChunks
      .filter(
        (c) =>
          c.vehicle_model_id === vehicle_model_id &&
          c.text.toLowerCase().includes(q),
      )
      .slice(0, limit)
      .map((c) => ({ text: c.text }));
  },

  async getCadMetadata(vehicle_model_id) {
    return cadMetadata.vehicle_model_id === vehicle_model_id
      ? { ...cadMetadata }
      : null;
  },

  async getOptionPrices(option_ids) {
    const map = new Map<string, number>();
    for (const id of option_ids) {
      const opt = options.find((o) => o.id === id);
      if (opt) map.set(id, opt.add_on_price_usd);
    }
    return map;
  },

  async saveSpec() {
    return "memory-stub-id";
  },

  async saveQuote() {
    return "memory-stub-id";
  },

  async listOrders() {
    return pastOrders;
  },

  async getOrder(order_id) {
    return pastOrders.find((o) => o.order_id === order_id) ?? null;
  },

  async listVehicleClasses() {
    return [
      { id: "CIT", code: "CIT", label: "Cash-in-Transit" },
      { id: "APC", code: "APC", label: "Armoured Personnel Carrier" },
      { id: "PPV", code: "PPV", label: "Passenger Protection Vehicle" },
      { id: "MILITARY", code: "MILITARY", label: "Military Tactical" },
      { id: "LE", code: "LE", label: "Law Enforcement" },
    ];
  },

  async listEngagements() {
    return [];
  },

  async getEngagement() {
    return null;
  },

  async createEngagement(input) {
    return { id: `eng-${Date.now()}`, reference: input.reference };
  },

  async createOrUpdateEngagementRequirements(input) {
    return input.requirements.length;
  },

  async runRequirementMatch(input) {
    const vehicle = vehicles[0];
    return {
      recommendation_id: `rec-${Date.now()}`,
      candidates: [
        {
          vehicle_model_id: vehicle.id,
          model_code: vehicle.model_code,
          type: vehicle.type,
          rank: 1,
          match_score: 0.85,
          match_tier: "CLOSE" as const,
          matched_mandatory: 3,
          total_mandatory: 4,
          matched_desired: 2,
          total_desired: 3,
          gaps: [],
          summary: "Memory-store mock recommendation",
        },
      ],
    };
  },

  async createSalesOrderFromEngagement(input) {
    return { sales_order_ref: input.sales_order_ref };
  },

  async buildStage3SpecSections() {
    return { specification_id: `spec-${Date.now()}`, sections_created: 1 };
  },

  async persistSpecTraceability() {
    return { linked_requirements: 1 };
  },

};
