import { getSql } from "../db/sql.js";
import type { DataStore } from "./types.js";

export const postgresStore: DataStore = {
  async listClients() {
    return getSql()`SELECT id, name, country FROM clients ORDER BY name`;
  },

  async listVehicles() {
    return getSql()`
      SELECT id, model_code, type, base_price_usd, lead_time_days, image_url
      FROM vehicle_models ORDER BY model_code
    `;
  },

  async listOptions(vehicle_model_id) {
    return getSql()`
      SELECT id, option_name AS name, category, add_on_price_usd
      FROM configuration_options
      WHERE vehicle_model_id = ${vehicle_model_id}
      ORDER BY category, option_name
    `;
  },

  async searchPastOrders(client_id, vehicle_model_id, limit = 3) {
    const rows = await getSql()`
      SELECT o.id AS order_id,
             to_char(o.created_at, 'YYYY-MM-DD') AS date,
             o.qty,
             o.status,
             string_agg(co.option_name, ', ' ORDER BY co.category) AS configuration_summary,
             array_agg(co.id ORDER BY co.category) AS configuration_option_ids,
             oq.unit_price_usd
      FROM orders o
      JOIN order_configurations oc ON oc.order_id = o.id
      JOIN configuration_options co ON co.id = oc.option_id
      LEFT JOIN order_quotes oq ON oq.order_id = o.id
      WHERE o.client_id = ${client_id}
        AND o.vehicle_model_id = ${vehicle_model_id}
        AND o.status IN ('Delivered', 'Client Approved', 'In Production')
      GROUP BY o.id, o.created_at, o.qty, o.status, oq.unit_price_usd
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((row, index) => ({
      order_id: row.order_id as string,
      date: row.date as string,
      qty: row.qty as number,
      status: row.status as string,
      configuration_summary: row.configuration_summary as string,
      configuration_option_ids: row.configuration_option_ids as string[],
      unit_price_usd: (row.unit_price_usd as number | null) ?? null,
      similarity_score: Math.max(0.5, 1 - index * 0.05),
    }));
  },

  async getVehicleModel(vehicle_model_id) {
    const rows = await getSql()`
      SELECT id, model_code, type, base_price_usd, lead_time_days, image_url
      FROM vehicle_models WHERE id = ${vehicle_model_id}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id as string,
      model_code: row.model_code as string,
      type: row.type as string,
      base_price_usd: row.base_price_usd as number,
      lead_time_days: row.lead_time_days as number,
      image_url: row.image_url as string | null,
    };
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
    const rows = await getSql()`
      SELECT delivery, compliance, notes
      FROM order_custom_requirements
      WHERE order_id = ${order_id}
      ORDER BY id DESC LIMIT 1
    `;
    const row = rows[0];
    if (!row) return { delivery: null, compliance: null, notes: null };
    return {
      delivery: row.delivery as string | null,
      compliance: row.compliance as string | null,
      notes: row.notes as string | null,
    };
  },

  async searchBuildContext(query, vehicle_model_id, limit = 3) {
    return getSql()`
      SELECT chunk_text AS text FROM document_chunks
      WHERE vehicle_model_id = ${vehicle_model_id}
        AND chunk_text ILIKE ${"%" + query + "%"}
      LIMIT ${limit}
    `;
  },

  async getCadMetadata(vehicle_model_id) {
    const rows = await getSql()`
      SELECT model_code, bom_reference, drawing_set_reference,
             weight_kg, length_mm, width_mm, height_mm
      FROM cad_metadata WHERE vehicle_model_id = ${vehicle_model_id}
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async getOptionPrices(option_ids) {
    const sql = getSql();
    const rows = await sql`
      SELECT id, add_on_price_usd FROM configuration_options
      WHERE id IN ${sql(option_ids)}
    `;
    return new Map(rows.map((r) => [r.id, r.add_on_price_usd]));
  },

  async saveSpec(order_id, spec_json) {
    const rows = await getSql()`
      INSERT INTO order_specs (order_id, spec_json)
      VALUES (${order_id}, ${getSql().json(spec_json as never)})
      ON CONFLICT (order_id) DO UPDATE
        SET spec_json = EXCLUDED.spec_json,
            version = order_specs.version + 1,
            generated_at = NOW()
      RETURNING id
    `;
    return rows[0].id;
  },

  async saveQuote(order_id, quote_json, unit_price_usd, total_usd) {
    const rows = await getSql()`
      INSERT INTO order_quotes (order_id, quote_json, unit_price_usd, total_usd)
      VALUES (
        ${order_id},
        ${getSql().json(quote_json as never)},
        ${unit_price_usd},
        ${total_usd}
      )
      ON CONFLICT (order_id) DO UPDATE
        SET quote_json = EXCLUDED.quote_json,
            unit_price_usd = EXCLUDED.unit_price_usd,
            total_usd = EXCLUDED.total_usd,
            version = order_quotes.version + 1,
            generated_at = NOW()
      RETURNING id
    `;
    return rows[0].id;
  },

  async listOrders(filters = {}) {
    if (filters.client_id && filters.status) {
      return [
        ...(await getSql()`
          SELECT o.id, o.client_id, o.vehicle_model_id, o.qty, o.status, o.created_at,
                 c.name AS client_name
          FROM orders o JOIN clients c ON c.id = o.client_id
          WHERE o.client_id = ${filters.client_id} AND o.status = ${filters.status}
          ORDER BY o.created_at DESC
        `),
      ];
    }
    if (filters.client_id) {
      return [
        ...(await getSql()`
          SELECT o.id, o.client_id, o.vehicle_model_id, o.qty, o.status, o.created_at,
                 c.name AS client_name
          FROM orders o JOIN clients c ON c.id = o.client_id
          WHERE o.client_id = ${filters.client_id}
          ORDER BY o.created_at DESC
        `),
      ];
    }
    if (filters.status) {
      return [
        ...(await getSql()`
          SELECT o.id, o.client_id, o.vehicle_model_id, o.qty, o.status, o.created_at,
                 c.name AS client_name
          FROM orders o JOIN clients c ON c.id = o.client_id
          WHERE o.status = ${filters.status}
          ORDER BY o.created_at DESC
        `),
      ];
    }
    return [
      ...(await getSql()`
        SELECT o.id, o.client_id, o.vehicle_model_id, o.qty, o.status, o.created_at,
               c.name AS client_name
        FROM orders o JOIN clients c ON c.id = o.client_id
        ORDER BY o.created_at DESC
      `),
    ];
  },

  async getOrder(order_id) {
    const orders = await getSql()`
      SELECT o.*, c.name AS client_name FROM orders o
      JOIN clients c ON c.id = o.client_id WHERE o.id = ${order_id}
    `;
    if (!orders[0]) return null;

    const [configuration, spec, quote, custom] = await Promise.all([
      getSql()`
        SELECT co.id, co.category, co.option_name, co.add_on_price_usd
        FROM order_configurations oc
        JOIN configuration_options co ON co.id = oc.option_id
        WHERE oc.order_id = ${order_id}
      `,
      getSql()`SELECT * FROM order_specs WHERE order_id = ${order_id}`,
      getSql()`SELECT * FROM order_quotes WHERE order_id = ${order_id}`,
      getSql()`
        SELECT * FROM order_custom_requirements WHERE order_id = ${order_id} LIMIT 1
      `,
    ]);

    return {
      order: orders[0],
      configuration,
      spec: spec[0] ?? null,
      quote: quote[0] ?? null,
      custom_requirements: custom[0] ?? null,
    };
  },
};
