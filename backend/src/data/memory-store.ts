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
};
