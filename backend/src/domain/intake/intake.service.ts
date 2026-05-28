import { STAGE1_FIELDS, type Stage1FieldAnswers, type IntakeExtraction } from "./intake.fields.js";

export function buildIntakeProgress(field_answers: Stage1FieldAnswers): {
  captured_sections: string[];
  missing_sections: string[];
  completeness: number;
  next_questions: string[];
} {
  const sectionByField = new Map(STAGE1_FIELDS.map((f) => [f.key, f.section]));
  const capturedSectionsSet = new Set<string>();
  const missingSectionsSet = new Set<string>();

  let requiredTotal = 0;
  let requiredCaptured = 0;

  for (const field of STAGE1_FIELDS) {
    const hasValue = Boolean(field_answers[field.key]?.trim());
    if (hasValue) capturedSectionsSet.add(sectionByField.get(field.key) ?? "GENERAL");
    if (field.required) {
      requiredTotal += 1;
      if (hasValue) requiredCaptured += 1;
      else missingSectionsSet.add(sectionByField.get(field.key) ?? "GENERAL");
    }
  }

  const next_questions = STAGE1_FIELDS.filter(
    (f) => f.required && !field_answers[f.key]?.trim(),
  )
    .slice(0, 3)
    .map((f) => f.question);

  return {
    captured_sections: Array.from(capturedSectionsSet),
    missing_sections: Array.from(missingSectionsSet),
    completeness: requiredTotal === 0 ? 0 : Number((requiredCaptured / requiredTotal).toFixed(2)),
    next_questions,
  };
}

function buildIntakeReview(field_answers: Stage1FieldAnswers): Record<string, Record<string, string | null>> {
  const grouped: Record<string, Record<string, string | null>> = {};
  for (const field of STAGE1_FIELDS) {
    if (!grouped[field.section]) grouped[field.section] = {};
    grouped[field.section][field.key] = field_answers[field.key] ?? null;
  }
  return grouped;
}

function capturePhrase(text: string, pattern: RegExp): string | undefined {
  const m = text.match(pattern);
  return m?.[0]?.trim();
}

function dedupeRequirements(
  requirements: Array<{
    section: string;
    parameter: string;
    value_text: string;
    priority?: "MANDATORY" | "DESIRED" | "OPTIONAL";
    source?: "CUSTOMER" | "AM_ASSUMED" | "ENGINEERING_DEFAULT";
    confirmed?: boolean;
  }>,
) {
  const seen = new Set<string>();
  return requirements.filter((r) => {
    const key = `${r.section}|${r.parameter}|${r.value_text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractIntakeFromIntent(
  intentRaw: string,
  context: { client_id: string; engagement_ref?: string },
): IntakeExtraction {
  const intent = intentRaw.toLowerCase();
  const field_answers: Stage1FieldAnswers = {};
  const requirements: IntakeExtraction["requirements"] = [];

  if (/\b(troop|personnel carrier|apc|casevac|patrol|vip|cash[\s-]*in[\s-]*transit)\b/.test(intent)) {
    field_answers.primary_role = capturePhrase(intentRaw, /(troop transport|personnel carrier|apc|casevac|patrol|vip|cash[\s-]*in[\s-]*transit)/i);
    requirements.push({
      section: "OPERATIONAL",
      parameter: "mission_profile",
      value_text: field_answers.primary_role ?? "general_protected_transport",
      priority: "MANDATORY",
      source: "CUSTOMER",
      confirmed: true,
    });
  }

  if (/\b(urban|desert|savannah|mountain|coastal|east africa|africa)\b/.test(intent)) {
    field_answers.operational_theatre = capturePhrase(intentRaw, /(urban|desert|savannah|mountain|coastal|east africa|africa)/i);
    field_answers.country_region = field_answers.operational_theatre;
  }

  if (/\b(ied|rpg|mine|small arms|asymmetric|high threat|blast)\b/.test(intent)) {
    field_answers.threat_environment = capturePhrase(intentRaw, /(ied|rpg|mine|small arms|asymmetric|high threat|blast)/i);
  }

  const qty = intentRaw.match(/(\d+)\s*(vehicles?|units?)/i);
  if (qty) field_answers.vehicle_quantity = qty[0];
  if (/\b(month|weeks?|delivery|timeline|first batch|urgent|asap)\b/i.test(intentRaw)) {
    field_answers.delivery_timeline = capturePhrase(
      intentRaw,
      /((?:within|in)\s+\d+\s*(?:months?|weeks?)|first batch[^.,;]*|delivery[^.,;]*)/i,
    );
  }

  if (/\b(crew|dismount|payload|stretcher|cargo)\b/.test(intent)) {
    const cp = capturePhrase(intentRaw, /(crew[^.,;]*|dismount[^.,;]*|payload[^.,;]*|stretcher[^.,;]*)/i);
    field_answers.crew = cp;
    field_answers.dismounts = cp;
    field_answers.cargo_payload = cp;
    field_answers.medical_configuration = cp;
  }

  if (/\b(stanag\s*4569\s*level\s*\d[a-z]?|level\s*[ivx0-9]+|ballistic|blast|mine)\b/.test(intent)) {
    const protection = capturePhrase(intentRaw, /(stanag[^.,;]*|level\s*[ivx0-9]+[^.,;]*|ballistic[^.,;]*|blast[^.,;]*)/i);
    field_answers.ballistic_small_arms = protection;
    field_answers.ballistic_ap = protection;
    field_answers.mine_underbelly = protection;
    field_answers.mine_side = protection;
    field_answers.ied_protection = protection;
    field_answers.rpg_protection = protection;
    field_answers.nbc_requirement = protection;
    requirements.push({
      section: "PROTECTION",
      parameter: "protection_baseline",
      value_text: protection ?? "level_3",
      priority: "MANDATORY",
      source: "CUSTOMER",
      confirmed: true,
    });
  }

  if (/\b(4x4|6x6|8x8|speed|range|terrain|fording|c-130|transportability)\b/.test(intent)) {
    const mobility = capturePhrase(intentRaw, /(4x4|6x6|8x8|speed[^.,;]*|range[^.,;]*|terrain[^.,;]*|c-130[^.,;]*)/i);
    field_answers.drive_configuration = mobility;
    field_answers.max_road_speed = mobility;
    field_answers.cross_country_speed = mobility;
    field_answers.operational_range = mobility;
    field_answers.fording_depth = mobility;
    field_answers.gradient = mobility;
    field_answers.side_slope = mobility;
    field_answers.ground_clearance = mobility;
    field_answers.air_transportability = mobility;
    if (/\b4x4\b/.test(intent) || /\b6x6\b/.test(intent) || /\b8x8\b/.test(intent)) {
      requirements.push({
        section: "MOBILITY",
        parameter: "drive_config",
        value_text: /\b8x8\b/.test(intent) ? "8x8" : /\b6x6\b/.test(intent) ? "6x6" : "4x4",
        priority: "DESIRED",
        source: "CUSTOMER",
        confirmed: true,
      });
    }
  }

  if (/\b(rws|hmg|agl|weapon|radio|bms|c4i|training|spares|warranty)\b/.test(intent)) {
    const systems = capturePhrase(intentRaw, /(rws[^.,;]*|hmg[^.,;]*|agl[^.,;]*|radio[^.,;]*|bms[^.,;]*|c4i[^.,;]*|training[^.,;]*|spares[^.,;]*|warranty[^.,;]*)/i);
    field_answers.primary_armament = systems;
    field_answers.mounting_type = systems;
    field_answers.night_capability = systems;
    field_answers.smoke_dischargers = systems;
    field_answers.firing_ports = systems;
    field_answers.radio_suite = systems;
    field_answers.bms_architecture = systems;
    field_answers.gps_navigation = systems;
    field_answers.intercom = systems;
    field_answers.antenna_provision = systems;
    field_answers.data_bus = systems;
    field_answers.training = systems;
    field_answers.spares_holding = systems;
    field_answers.warranty = systems;
  }

  const budgetLine = capturePhrase(intentRaw, /(\$|usd|budget|million|financing|offset|incoterm|ddp|fixed[-\s]*price)[^.,;]*/i);
  if (budgetLine) {
    field_answers.indicative_budget = budgetLine;
    field_answers.financing_requirement = budgetLine;
    field_answers.offset_requirement = budgetLine;
    field_answers.incoterms = budgetLine;
    field_answers.preferred_contract_type = budgetLine;
  }

  field_answers.customer_organisation ??= context.client_id;
  field_answers.opportunity_reference ??= context.engagement_ref;

  const urgency: IntakeExtraction["signals"]["urgency"] =
    /\b(urgent|asap|immediately|critical)\b/.test(intent) ? "HIGH" : /\b(soon|timeline|delivery)\b/.test(intent) ? "MEDIUM" : "LOW";
  const confidence: IntakeExtraction["signals"]["confidence"] =
    Object.values(field_answers).filter(Boolean).length >= 16
      ? "HIGH"
      : Object.values(field_answers).filter(Boolean).length >= 8
        ? "MEDIUM"
        : "LOW";
  const sentiment: IntakeExtraction["signals"]["sentiment"] =
    /\b(need|must|required|mandatory)\b/.test(intent) ? "ASSERTIVE" : /\b(concern|risk|worried|threat)\b/.test(intent) ? "CONCERNED" : "NEUTRAL";
  const budget_sensitivity: IntakeExtraction["signals"]["budget_sensitivity"] =
    /\b(budget|cost|price|afford|cheaper)\b/.test(intent) ? "HIGH" : /\b(option|value)\b/.test(intent) ? "MEDIUM" : "LOW";

  return {
    field_answers,
    intake_review: buildIntakeReview(field_answers),
    requirements: dedupeRequirements(requirements),
    signals: { urgency, confidence, sentiment, budget_sensitivity },
  };
}
