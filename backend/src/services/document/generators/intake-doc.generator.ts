/**
 * Intake Document Generator
 * 
 * Generates formatted Stage 1 intake documents from captured state.
 */

export class IntakeDocGenerator {
  generate(state: any): string {
    const fa = state.field_answers || {};
    const who = state.client_id || "Unknown Client";

    const sections = this.getSections();
    const sectionTables = sections.map((sec) => this.buildSectionTable(sec, fa));

    const actionItems = this.buildActionItems(state);

    return [
      `# Customer Requirements Intake`,
      `## Armoured Personnel Carrier Programme`,
      `**Stage 1 of 3 — Completed by Account Manager during customer engagement**`,
      `**Customer:** ${fa.customer_organisation ?? who}`,
      `**Opportunity Ref:** ${fa.opportunity_reference ?? "TBD"}`,
      `**Date:** ${new Date().toISOString().slice(0, 10)}`,
      `---`,
      ...sectionTables,
      `---`,
      `### Section 9 — Action Items`,
      actionItems,
      `---`,
      `### Section 10 — Signatures`,
      `| Role | Name | Signature | Date |`,
      `|:---|:---|:---|:---|`,
      `| Account Manager | ${fa.account_manager ?? "—"} | | |`,
      `| Customer Representative | ${fa.customer_representative ?? "—"} | | |`,
    ].join("\n\n");
  }

  private buildSectionTable(sec: any, fa: any): string {
    const rows = sec.fields
      .map((f: any) => {
        const v = fa[f.key];
        const flag = !v && f.required ? " **[PENDING — MANDATORY]**" : "";
        return `| **${f.label}** | ${v ?? "—"}${flag} |`;
      })
      .join("\n");
    return `### ${sec.title}\n| Field | Customer Input |\n|:---|:---|\n${rows}`;
  }

  private buildActionItems(state: any): string {
    const pendingFlags = state.pending_flags || [];
    if (pendingFlags.length === 0) {
      return "_No open mandatory items._";
    }

    const rows = pendingFlags
      .map((p: string, i: number) => `| ${i + 1} | ${p} | Account Manager | TBD |`)
      .join("\n");

    return `| # | Action | Owner | Due Date |\n|---|---|---|---|\n${rows}`;
  }

  private getSections() {
    return [
      {
        title: "Section 1 — Customer & Engagement",
        fields: [
          { key: "customer_organisation", label: "Customer Organisation", required: true },
          { key: "country_region", label: "Country / Region", required: true },
          { key: "opportunity_reference", label: "Opportunity Reference", required: false },
          { key: "procurement_type", label: "Procurement Type", required: true },
          { key: "account_manager", label: "Account Manager", required: true },
          { key: "customer_representative", label: "Customer Representative", required: false },
        ],
      },
      {
        title: "Section 2 — Mission & Role",
        fields: [
          { key: "primary_role", label: "Primary Mission Role", required: true },
          { key: "secondary_role", label: "Secondary Mission Role", required: false },
          { key: "operational_theatre", label: "Operational Theatre", required: true },
          { key: "threat_environment", label: "Threat Environment", required: true },
        ],
      },
      {
        title: "Section 3 — Personnel & Payload",
        fields: [
          { key: "crew", label: "Crew", required: true },
          { key: "dismounts", label: "Dismounts", required: true },
          { key: "soldier_load_kg", label: "Soldier Load (kg)", required: false },
        ],
      },
      {
        title: "Section 4 — Protection",
        fields: [
          { key: "ballistic_small_arms", label: "Ballistic Protection (Small Arms)", required: true },
          { key: "ballistic_ap", label: "Ballistic Protection (AP)", required: false },
          { key: "mine_underbelly", label: "Mine Blast Protection (Underbelly)", required: true },
          { key: "mine_side", label: "Mine Blast Protection (Side)", required: false },
          { key: "rpg_protection", label: "RPG Protection", required: false },
          { key: "nbc_cbrn", label: "NBC/CBRN Overpressure", required: false },
        ],
      },
      {
        title: "Section 5 — Mobility",
        fields: [
          { key: "drive_configuration", label: "Drive Configuration", required: true },
          { key: "air_transportability", label: "Air Transportability", required: false },
          { key: "max_speed_kmh", label: "Max Speed (km/h)", required: false },
          { key: "range_km", label: "Range (km)", required: false },
        ],
      },
      {
        title: "Section 6 — Weapon System",
        fields: [
          { key: "primary_armament", label: "Primary Armament", required: false },
          { key: "mounting_type", label: "Mounting Type", required: false },
          { key: "night_capability", label: "Night / All-Weather Capability", required: false },
        ],
      },
      {
        title: "Section 7 — C4I",
        fields: [
          { key: "radio_suite", label: "Radio Suite", required: false },
          { key: "bms_requirement", label: "BMS Requirement", required: false },
          { key: "data_bus", label: "Data Bus Architecture", required: false },
        ],
      },
      {
        title: "Section 8 — Logistics & Support",
        fields: [
          { key: "training", label: "Training", required: false },
          { key: "warranty", label: "Warranty", required: false },
          { key: "spares_package", label: "Spares Package", required: false },
          { key: "in_country_support", label: "In-Country Support", required: false },
          { key: "technology_transfer", label: "Technology Transfer", required: false },
        ],
      },
      {
        title: "Section 9 — Commercial",
        fields: [
          { key: "vehicle_quantity", label: "Vehicle Quantity", required: true },
          { key: "delivery_timeline", label: "Delivery Timeline", required: true },
          { key: "indicative_budget", label: "Indicative Budget (USD)", required: false },
          { key: "offset_requirement", label: "Offset Requirement", required: false },
          { key: "incoterms", label: "Incoterms", required: false },
          { key: "contract_type", label: "Contract Type", required: false },
          { key: "documentation_language", label: "Documentation Language", required: false },
        ],
      },
    ];
  }
}
