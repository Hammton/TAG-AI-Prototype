import { getSql } from "../db/sql.js";
import type { DataStore } from "./types.js";

function leadTime(baseSpecs: unknown): number {
  const v = (baseSpecs as Record<string, unknown> | null)?.lead_time_days;
  return typeof v === "number" ? v : 90;
}

function imageUrl(baseSpecs: unknown): string | null {
  const v = (baseSpecs as Record<string, unknown> | null)?.image_url;
  return typeof v === "string" ? v : null;
}

function modelCode(baseSpecs: unknown, fallbackLegacy: string): string {
  const v = (baseSpecs as Record<string, unknown> | null)?.model_code;
  return typeof v === "string" ? v : fallbackLegacy.replace("VEH-", "");
}

export const postgresStore: DataStore = {
  async listClients() {
    return getSql()`
      SELECT legacy_code AS id, name, country
      FROM organisation
      WHERE type = 'CUSTOMER' AND legacy_code IS NOT NULL
      ORDER BY name
    `;
  },

  async listVehicles() {
    const rows = await getSql()`
      SELECT vm.legacy_code,
             vm.base_specs,
             vc.label AS class_label,
             COALESCE(vms.value_numeric, 0) AS base_price_usd
      FROM vehicle_model vm
      JOIN vehicle_class vc ON vc.id = vm.class_id
      LEFT JOIN vehicle_model_spec vms
        ON vms.model_id = vm.id
       AND vms.param_code = 'base_price_usd'
      WHERE vm.active = TRUE AND vm.legacy_code IS NOT NULL
      ORDER BY vm.legacy_code
    `;

    return rows.map((r) => ({
      id: r.legacy_code as string,
      model_code: modelCode(r.base_specs, r.legacy_code as string),
      type: `${r.class_label as string} - ${modelCode(r.base_specs, r.legacy_code as string)}`,
      base_price_usd: Number(r.base_price_usd ?? 0),
      lead_time_days: leadTime(r.base_specs),
      image_url: imageUrl(r.base_specs),
    }));
  },

  async listOptions(vehicle_model_id) {
    return getSql()`
      SELECT vo.legacy_code AS id, vo.option_name AS name, vo.category, vo.add_on_price_usd
      FROM vehicle_option vo
      JOIN vehicle_model vm ON vm.id = vo.vehicle_model_id
      WHERE vm.legacy_code = ${vehicle_model_id}
      ORDER BY vo.category, vo.option_name
    `;
  },

  async searchPastOrders(client_id, vehicle_model_id, limit = 3) {
    const rows = await getSql()`
      SELECT so.legacy_code AS order_id,
             to_char(so.created_at, 'YYYY-MM-DD') AS date,
             COALESCE(ob.quantity, 1) AS qty,
             so.status,
             string_agg(li.description, ', ' ORDER BY li.line_number) AS configuration_summary,
             array_remove(array_agg(vo.legacy_code ORDER BY vo.category), NULL) AS configuration_option_ids,
             MAX(li.unit_price_usd) AS unit_price_usd
      FROM sales_order so
      JOIN organisation o ON o.id = so.customer_org_id
      LEFT JOIN order_batch ob ON ob.order_id = so.id
      LEFT JOIN line_item li ON li.order_id = so.id
      LEFT JOIN vehicle_model vm ON vm.id = ob.vehicle_model_id
      LEFT JOIN vehicle_option vo
        ON vo.vehicle_model_id = vm.id
       AND li.description ILIKE ('%' || vo.option_name || '%')
      WHERE o.legacy_code = ${client_id}
        AND vm.legacy_code = ${vehicle_model_id}
      GROUP BY so.legacy_code, so.created_at, so.status, ob.quantity
      ORDER BY so.created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((row, index) => ({
      order_id: row.order_id as string,
      date: row.date as string,
      qty: Number(row.qty ?? 1),
      status: row.status as string,
      configuration_summary: (row.configuration_summary as string | null) ?? "",
      configuration_option_ids: ((row.configuration_option_ids as string[] | null) ?? []).filter(Boolean),
      unit_price_usd: row.unit_price_usd === null ? null : Number(row.unit_price_usd),
      similarity_score: Math.max(0.5, 1 - index * 0.05),
    }));
  },

  async getVehicleModel(vehicle_model_id) {
    const rows = await getSql()`
      SELECT vm.legacy_code, vm.base_specs, vc.label AS class_label,
             COALESCE(vms.value_numeric, 0) AS base_price_usd
      FROM vehicle_model vm
      JOIN vehicle_class vc ON vc.id = vm.class_id
      LEFT JOIN vehicle_model_spec vms
        ON vms.model_id = vm.id
       AND vms.param_code = 'base_price_usd'
      WHERE vm.legacy_code = ${vehicle_model_id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.legacy_code as string,
      model_code: modelCode(row.base_specs, row.legacy_code as string),
      type: `${row.class_label as string} - ${modelCode(row.base_specs, row.legacy_code as string)}`,
      base_price_usd: Number(row.base_price_usd ?? 0),
      lead_time_days: leadTime(row.base_specs),
      image_url: imageUrl(row.base_specs),
    };
  },

  async getConfigurationOptions(vehicle_model_id) {
    const rows = await this.listOptions(vehicle_model_id);
    const categories: Record<string, Array<{ id: string; name: string; add_on_price: number }>> = {};
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
      SELECT
        max(CASE WHEN r.parameter = 'delivery_location' THEN r.value_text END) AS delivery,
        max(CASE WHEN r.parameter IN ('emc_compliance','compliance_standard') THEN r.value_text END) AS compliance,
        max(CASE WHEN r.parameter IN ('exterior_finish_notes','build_notes') THEN r.value_text END) AS notes
      FROM requirement r
      JOIN engagement e ON e.id = r.engagement_id
      LEFT JOIN sales_order so ON so.engagement_id = e.id
      WHERE so.legacy_code = ${order_id} OR e.reference = 'AVP-2026-POC'
    `;
    const row = rows[0];
    return {
      delivery: (row?.delivery as string | null) ?? null,
      compliance: (row?.compliance as string | null) ?? null,
      notes: (row?.notes as string | null) ?? null,
    };
  },

  async searchBuildContext(query, vehicle_model_id, limit = 3) {
    return getSql()`
      SELECT dc.chunk_text AS text
      FROM document_chunks dc
      JOIN vehicle_model vm ON vm.id = dc.vehicle_model_id
      WHERE vm.legacy_code = ${vehicle_model_id}
        AND dc.chunk_text ILIKE ${"%" + query + "%"}
      LIMIT ${limit}
    `;
  },

  async getCadMetadata(vehicle_model_id) {
    const rows = await getSql()`
      SELECT vm.base_specs
      FROM vehicle_model vm
      WHERE vm.legacy_code = ${vehicle_model_id}
      LIMIT 1
    `;
    return (rows[0]?.base_specs as Record<string, unknown> | undefined) ?? null;
  },

  async getOptionPrices(option_ids) {
    const sql = getSql();
    const rows = await sql`
      SELECT legacy_code AS id, add_on_price_usd
      FROM vehicle_option
      WHERE legacy_code IN ${sql(option_ids)}
    `;
    return new Map(rows.map((r) => [r.id as string, Number(r.add_on_price_usd)]));
  },

  async saveSpec(order_id, spec_json) {
    const rows = await getSql()`
      WITH so AS (
        SELECT id FROM sales_order WHERE legacy_code = ${order_id}
      ), upsert_spec AS (
        INSERT INTO specification (document_number, revision, order_id, status, classification, updated_at)
        SELECT 'AVP-SPEC-' || ${order_id}, 1, so.id, 'DRAFT', 'UNCLASSIFIED', NOW() FROM so
        ON CONFLICT DO NOTHING
        RETURNING id
      ), resolved AS (
        SELECT id FROM upsert_spec
        UNION ALL
        SELECT s.id FROM specification s JOIN so ON s.order_id = so.id ORDER BY s.updated_at DESC LIMIT 1
      )
      INSERT INTO spec_section (spec_id, section_code, section_title, depth, sort_order, narrative, requirements, tables, updated_at)
      SELECT resolved.id, 'GENERAL', 'Generated Snapshot', 'FULL', 1, 'System-generated snapshot',
             ${getSql().json(spec_json as never)}, '{}'::jsonb, NOW()
      FROM resolved
      ON CONFLICT DO NOTHING
      RETURNING spec_id AS id
    `;
    return (rows[0]?.id as string | undefined) ?? "";
  },

  async saveQuote(order_id, quote_json, _unit_price_usd, total_usd) {
    const sql = getSql();
    const orderRows = await sql`
      UPDATE sales_order
      SET total_value_usd = ${total_usd},
          commercial_terms = commercial_terms || jsonb_build_object('quote_snapshot', ${sql.json(quote_json as never)}),
          updated_at = NOW()
      WHERE legacy_code = ${order_id}
      RETURNING id
    `;
    return (orderRows[0]?.id as string | undefined) ?? "";
  },

  async listOrders(filters = {}) {
    return [
      ...(await getSql()`
      SELECT so.legacy_code AS id,
             o.legacy_code AS client_id,
             vm.legacy_code AS vehicle_model_id,
             COALESCE(ob.quantity, 1) AS qty,
             so.status,
             so.created_at,
             o.name AS client_name
      FROM sales_order so
      JOIN organisation o ON o.id = so.customer_org_id
      LEFT JOIN order_batch ob ON ob.order_id = so.id
      LEFT JOIN vehicle_model vm ON vm.id = ob.vehicle_model_id
      WHERE (${filters.client_id ?? null}::text IS NULL OR o.legacy_code = ${filters.client_id ?? null})
        AND (${filters.status ?? null}::text IS NULL OR so.status = ${filters.status ?? null})
      ORDER BY so.created_at DESC
    `),
    ];
  },

  async getOrder(order_id) {
    const orders = await getSql()`
      SELECT so.*, o.name AS client_name, o.legacy_code AS client_id
      FROM sales_order so
      JOIN organisation o ON o.id = so.customer_org_id
      WHERE so.legacy_code = ${order_id}
      LIMIT 1
    `;
    if (!orders[0]) return null;

    const [configuration, spec, custom] = await Promise.all([
      getSql()`
        SELECT li.description AS option_name,
               li.category,
               li.unit_price_usd AS add_on_price_usd
        FROM line_item li
        WHERE li.order_id = ${orders[0].id}
        ORDER BY li.line_number
      `,
      getSql()`
        SELECT s.*, ss.requirements AS spec_json
        FROM specification s
        LEFT JOIN spec_section ss ON ss.spec_id = s.id
        WHERE s.order_id = ${orders[0].id}
        ORDER BY s.updated_at DESC
        LIMIT 1
      `,
      this.getCustomRequirements(order_id),
    ]);

    return {
      order: orders[0],
      configuration,
      spec: spec[0] ?? null,
      quote: {
        total_usd: orders[0].total_value_usd ?? null,
        quote_json: (orders[0].commercial_terms as Record<string, unknown> | null)?.quote_snapshot ?? null,
      },
      custom_requirements: custom,
    };
  },

  async listVehicleClasses() {
    return getSql()`SELECT id::text AS id, code, label FROM vehicle_class ORDER BY code`;
  },

  async listEngagements(filters = {}) {
    return [
      ...(await getSql()`
      SELECT e.id::text AS id, e.reference, e.status, o.legacy_code AS client_id, o.name AS client_name, e.created_at
      FROM engagement e
      JOIN organisation o ON o.id = e.customer_org_id
      WHERE (${filters.client_id ?? null}::text IS NULL OR o.legacy_code = ${filters.client_id ?? null})
        AND (${filters.status ?? null}::text IS NULL OR e.status = ${filters.status ?? null})
      ORDER BY e.created_at DESC
    `),
    ];
  },

  async getEngagement(reference) {
    const rows = await getSql()`
      SELECT e.*, o.legacy_code AS client_id, o.name AS client_name
      FROM engagement e
      JOIN organisation o ON o.id = e.customer_org_id
      WHERE e.reference = ${reference}
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async createEngagement(input) {
    const rows = await getSql()`
      WITH org AS (
        SELECT id FROM organisation WHERE legacy_code = ${input.customer_org_code} LIMIT 1
      ),
      am AS (
        SELECT id FROM app_user WHERE legacy_code = ${input.account_manager_code ?? 'AM-001'} LIMIT 1
      ),
      vc AS (
        SELECT id FROM vehicle_class WHERE code = ${input.vehicle_class_code} LIMIT 1
      )
      INSERT INTO engagement (
        reference, customer_org_id, account_manager_id, vehicle_class_id, status, country_of_use, theatre, am_notes
      )
      SELECT ${input.reference}, org.id, am.id, vc.id, ${input.status ?? 'DRAFT'}, ${input.country_of_use ?? null}, ${input.theatre ?? null}, ${input.am_notes ?? null}
      FROM org, am, vc
      RETURNING id::text AS id, reference
    `;
    if (!rows[0]) throw new Error("unable_to_create_engagement");
    return rows[0] as { id: string; reference: string };
  },

  async createOrUpdateEngagementRequirements(input) {
    let count = 0;
    for (const req of input.requirements) {
      await getSql()`
        INSERT INTO requirement (
          engagement_id, section, parameter, value_text, priority, source, confirmed
        )
        SELECT e.id, ${req.section}, ${req.parameter}, ${req.value_text},
               ${req.priority ?? "MANDATORY"}, ${req.source ?? "CUSTOMER"}, ${req.confirmed ?? true}
        FROM engagement e
        WHERE e.reference = ${input.engagement_ref}
      `;
      count += 1;
    }
    return count;
  },

  async runRequirementMatch(input) {
    const reqRows = await getSql()`
      SELECT r.id, r.parameter, COALESCE(r.value_text, r.value_code, '') AS required_value, r.priority
      FROM requirement r
      JOIN engagement e ON e.id = r.engagement_id
      WHERE e.reference = ${input.engagement_ref}
        AND r.confirmed = TRUE
    `;

    const candidateRows = await getSql()`
      SELECT vm.id, vm.legacy_code, vc.label, vm.base_specs
      FROM vehicle_model vm
      JOIN vehicle_class vc ON vc.id = vm.class_id
      WHERE vm.active = TRUE
        AND (${input.vehicle_model_id ?? null}::text IS NULL OR vm.legacy_code = ${input.vehicle_model_id ?? null})
      ORDER BY vm.legacy_code
    `;

    const recommendationIdRows = await getSql()`
      INSERT INTO recommendation (
        engagement_id, status, strategy, requirements_total, requirements_met, requirements_partial, requirements_unmet, match_score, generated_at
      )
      SELECT e.id, 'DRAFT', 'EXACT_MATCH', 0, 0, 0, 0, 0, NOW()
      FROM engagement e
      WHERE e.reference = ${input.engagement_ref}
      RETURNING id::text AS id
    `;
    const recommendation_id = (recommendationIdRows[0]?.id as string | undefined) ?? "";

    const candidates: {
      vehicle_model_id: string;
      model_code: string;
      type: string;
      rank: number;
      match_score: number;
      match_tier: "EXACT" | "CLOSE" | "POSSIBLE" | "REQUIRES_CUSTOMISATION";
      matched_mandatory: number;
      total_mandatory: number;
      matched_desired: number;
      total_desired: number;
      gaps: Array<{ parameter: string; required: string; actual: string; severity: string }>;
      summary: string;
    }[] = [];

    for (const vm of candidateRows) {
      const specs = await getSql()`
        SELECT param_code, COALESCE(value_numeric::text, value_text, '') AS actual_value
        FROM vehicle_model_spec
        WHERE model_id = ${vm.id}
      `;
      const specMap = new Map(specs.map((s) => [s.param_code as string, (s.actual_value as string) ?? ""]));
      let mandatoryMet = 0;
      let desiredMet = 0;
      const mandatoryTotal = reqRows.filter((r) => (r.priority as string) === "MANDATORY").length;
      const desiredTotal = reqRows.filter((r) => (r.priority as string) !== "MANDATORY").length;
      const gaps: Array<{ parameter: string; required: string; actual: string; severity: string }> = [];
      for (const r of reqRows) {
        const actual = specMap.get(r.parameter as string) ?? "";
        const met = actual !== "";
        if ((r.priority as string) === "MANDATORY") {
          if (met) mandatoryMet += 1;
          else gaps.push({ parameter: r.parameter as string, required: r.required_value as string, actual, severity: "BLOCKING" });
        } else if (met) {
          desiredMet += 1;
        } else {
          gaps.push({ parameter: r.parameter as string, required: r.required_value as string, actual, severity: "MINOR" });
        }
      }
      const denom = mandatoryTotal * 2 + desiredTotal * 0.5 || 1;
      const score = (mandatoryMet * 2 + desiredMet * 0.5) / denom;
      const match_tier: "EXACT" | "CLOSE" | "POSSIBLE" | "REQUIRES_CUSTOMISATION" =
        mandatoryTotal > 0 && mandatoryMet < mandatoryTotal
          ? "REQUIRES_CUSTOMISATION"
          : score > 0.9
            ? "EXACT"
            : score > 0.7
              ? "CLOSE"
              : "POSSIBLE";

      const candidateRowsInsert = await getSql()`
        INSERT INTO recommendation_candidate (
          recommendation_id, vehicle_model_id, rank, match_score, match_tier,
          matched_mandatory, total_mandatory, matched_desired, total_desired, gaps, summary
        )
        VALUES (
          ${recommendation_id}, ${vm.id}, 1, ${score}, ${match_tier},
          ${mandatoryMet}, ${mandatoryTotal}, ${desiredMet}, ${desiredTotal},
          ${getSql().json(gaps as never)},
          ${`Matched ${mandatoryMet}/${mandatoryTotal} mandatory requirements`}
        )
        RETURNING id::text AS id
      `;
      const candidateId = candidateRowsInsert[0]?.id as string | undefined;
      if (candidateId) {
        for (const r of reqRows) {
          const actual = specMap.get(r.parameter as string) ?? "";
          await getSql()`
            INSERT INTO requirement_match (
              candidate_id, requirement_id, result, match_type, required_value, actual_value, gap_severity, notes
            ) VALUES (
              ${candidateId},
              ${r.id},
              ${actual ? "MET" : "UNMET"},
              ${actual ? "EXACT" : "NOT_ASSESSED"},
              NULL, NULL,
              ${actual ? "NONE" : "BLOCKING"},
              ${`parameter=${r.parameter as string}`}
            )
          `;
        }
      }

      candidates.push({
        vehicle_model_id: vm.legacy_code as string,
        model_code: modelCode(vm.base_specs, vm.legacy_code as string),
        type: vm.label as string,
        rank: 1,
        match_score: score,
        match_tier,
        matched_mandatory: mandatoryMet,
        total_mandatory: mandatoryTotal,
        matched_desired: desiredMet,
        total_desired: desiredTotal,
        gaps,
        summary: `Matched ${mandatoryMet}/${mandatoryTotal} mandatory requirements`,
      });
    }

    candidates.sort((a, b) => b.match_score - a.match_score).forEach((c, i) => (c.rank = i + 1));
    return { recommendation_id, candidates };
  },

  async createSalesOrderFromEngagement(input) {
    await getSql()`
      WITH e AS (SELECT * FROM engagement WHERE reference = ${input.engagement_ref} LIMIT 1),
      vm AS (SELECT id FROM vehicle_model WHERE legacy_code = ${input.vehicle_model_id} LIMIT 1)
      INSERT INTO sales_order (
        legacy_code, reference, engagement_id, customer_org_id, account_manager_id, vehicle_class_id, status
      )
      SELECT ${input.sales_order_ref}, ${`SO-${input.sales_order_ref}`}, e.id, e.customer_org_id, e.account_manager_id, e.vehicle_class_id, 'DRAFT'
      FROM e
      ON CONFLICT (legacy_code) DO NOTHING
    `;
    return { sales_order_ref: input.sales_order_ref };
  },

  async buildStage3SpecSections(input) {
    const rows = await getSql()`
      WITH so AS (SELECT id, vehicle_class_id FROM sales_order WHERE legacy_code = ${input.sales_order_ref} LIMIT 1),
      upsert_spec AS (
        INSERT INTO specification (document_number, revision, order_id, vehicle_class_id, status, classification, authored_by, issued_at, updated_at)
        SELECT ${input.spec_document_number}, 1, so.id, so.vehicle_class_id, 'DRAFT', 'UNCLASSIFIED', NULL, NOW(), NOW()
        FROM so
        ON CONFLICT DO NOTHING
        RETURNING id
      ),
      spec_row AS (
        SELECT id FROM upsert_spec
        UNION ALL
        SELECT s.id FROM specification s JOIN so ON so.id = s.order_id WHERE s.document_number = ${input.spec_document_number} LIMIT 1
      )
      INSERT INTO spec_section (spec_id, section_code, section_title, depth, sort_order, narrative, requirements, tables)
      SELECT spec_row.id, 'GENERAL', 'General Requirements', 'FULL', 1, 'Generated from engagement and order requirements', '[]'::jsonb, '{}'::jsonb
      FROM spec_row
      ON CONFLICT DO NOTHING
      RETURNING spec_id::text AS id
    `;
    return { specification_id: (rows[0]?.id as string | undefined) ?? "", sections_created: rows.length };
  },

  async persistSpecTraceability(input) {
    const rows = await getSql()`
      WITH spec_row AS (
        SELECT s.id AS spec_id, s.order_id
        FROM specification s
        WHERE s.document_number = ${input.spec_document_number}
        ORDER BY s.updated_at DESC
        LIMIT 1
      ),
      reqs AS (
        SELECT r.id, r.parameter, r.value_text
        FROM requirement r
        JOIN engagement e ON e.id = r.engagement_id
        JOIN sales_order so ON so.engagement_id = e.id
        JOIN spec_row sp ON sp.order_id = so.id
      )
      INSERT INTO spec_requirement (spec_id, source_requirement_id, parameter, requirement_text, mandatory, status)
      SELECT sp.spec_id, reqs.id, reqs.parameter, COALESCE(reqs.value_text, reqs.parameter), TRUE, 'BASELINED'
      FROM spec_row sp, reqs
      RETURNING id
    `;
    return { linked_requirements: rows.length };
  },

};
