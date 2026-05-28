import { getStore } from "../../data/index.js";
import { getConfigurationOptions, listVehicleModels, searchPastOrders } from "../vehicle/vehicle.service.js";
import { extractIntakeFromIntent } from "../intake/intake.service.js";
import { buildIntakeProgress } from "../intake/intake.service.js";

function recommendedOptionsFromConfig(
  configOptions: Awaited<ReturnType<typeof getConfigurationOptions>>,
  optionIds: string[],
): string[] {
  const optionNamesById = new Map(
    Object.values(configOptions.categories)
      .flat()
      .map((option) => [option.id, option.name]),
  );
  return optionIds.map((id) => optionNamesById.get(id) ?? id);
}

function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[\s-_]/g, "");
}

type VehicleRow = Awaited<ReturnType<typeof listVehicleModels>>[number];

function findExplicitVehicleMention(
  vehicles: VehicleRow[],
  intent: string,
): VehicleRow | "unknown" | null {
  const intentNorm = normalizeCode(intent);

  const byCodeLength = [...vehicles].sort(
    (a, b) => normalizeCode(b.model_code).length - normalizeCode(a.model_code).length,
  );
  for (const vehicle of byCodeLength) {
    const code = normalizeCode(vehicle.model_code);
    if (code.length >= 4 && intentNorm.includes(code)) {
      return vehicle;
    }
  }

  const tokens = intent.split(/\s+/).filter((t) => t.length > 2);
  for (const token of tokens) {
    const t = normalizeCode(token);
    if (t.length < 4) continue;
    const hit = vehicles.find((v) => normalizeCode(v.model_code).includes(t));
    if (hit) return hit;
  }

  if (/\bifv\b|infantry fighting/.test(intent) && !/\bapc\b|personnel carrier/.test(intent)) {
    const ifv = vehicles.find((v) => normalizeCode(v.model_code).includes("ifv"));
    if (ifv) return ifv;
    if (/\bbatt[\s-]*ifv\b/.test(intent)) return "unknown";
  }

  return null;
}

const VEHICLE_INTENT_PATTERN =
  /\b(apc|armored|armoured|vehicle|troop|carrier|tactical|protection|mine|ambulance|utility|desert|combat|personnel|level\s*iii|4wd|diesel|wheelbase|mission|fleet|transport|blast|deploy|cash|transit|vip|suv|atv|polaris|land\s*cruiser|recommend|configure)\b/;

export function hasMeaningfulVehicleIntent(intent: string): boolean {
  if (intent.length < 12) return VEHICLE_INTENT_PATTERN.test(intent);
  return intent.split(/\s+/).filter((w) => w.length > 2).length >= 2;
}

export function scoreVehicleForIntent(
  vehicle: { model_code: string; type: string },
  intent: string,
) {
  const haystack = `${vehicle.model_code} ${vehicle.type}`
    .toLowerCase()
    .replace(/[-_/]/g, " ");
  let score = 0;

  for (const token of haystack.split(/\s+/)) {
    if (token.length > 2 && intent.includes(token)) score += 1;
  }

  const boosts: Array<[string[], string[], number]> = [
    [["ifv", "infantry fighting", "fighting vehicle"], ["ifv", "infantry fighting"], 10],
    [["personnel", "carrier", "troop", "tactical response", "police"], ["personnel carrier", "apc", "batt apc"], 8],
    [["cash", "transit", "bullion", "bank"], ["cash", "transit"], 8],
    [["vip", "executive", "suv", "passenger"], ["passenger protection", "escalade", "suv"], 7],
    [["land cruiser", "vr7", "vpam"], ["land cruiser", "tlc", "vr7"], 7],
    [["atv", "polaris", "off road", "patrol"], ["polaris", "atv", "ld 1"], 7],
    [["utility", "desert", "pickup"], ["tactical utility", "tuv"], 5],
  ];

  for (const [intentTerms, vehicleTerms, weight] of boosts) {
    if (
      intentTerms.some((term) => intent.includes(term)) &&
      vehicleTerms.some((term) => haystack.includes(term))
    ) {
      score += weight;
    }
  }

  return score;
}

export async function recommendFromClientIntent(input: {
  client_id: string;
  engagement_ref?: string;
  user_text?: string;
  opportunity_note?: string;
  vehicle_model_id?: string;
}) {
  const vehicles = await listVehicleModels();
  if (vehicles.length === 0) {
    throw new Error("No vehicle models available");
  }

  const intent = `${input.user_text ?? ""} ${input.opportunity_note ?? ""}`.trim();
  const normalizedIntent = intent.toLowerCase().replace(/[-_/]/g, " ");
  const extracted = extractIntakeFromIntent(intent, {
    client_id: input.client_id,
    engagement_ref: input.engagement_ref,
  });
  const intakeProgress = buildIntakeProgress(extracted.field_answers);

  if (!input.vehicle_model_id && !hasMeaningfulVehicleIntent(normalizedIntent)) {
    throw new Error(
      "insufficient_intent: describe the vehicle type, mission, or protection requirements",
    );
  }

  const explicit = findExplicitVehicleMention(vehicles, normalizedIntent);
  if (explicit === "unknown") {
    throw new Error(
      "unknown_model: the requested model code is not in the TAG catalogue for this PoC",
    );
  }

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === input.vehicle_model_id) ??
    explicit ??
    vehicles
      .map((vehicle) => ({ vehicle, score: scoreVehicleForIntent(vehicle, normalizedIntent) }))
      .sort((a, b) => b.score - a.score)[0]?.vehicle ??
    vehicles[0];

  const [history, configOptions] = await Promise.all([
    searchPastOrders(input.client_id, selectedVehicle.id, 3),
    getConfigurationOptions(selectedVehicle.id),
  ]);

  if (input.engagement_ref && intent.trim().length > 0) {
    const extractedRequirements = extracted.requirements;
    if (extractedRequirements.length > 0) {
      await getStore().createOrUpdateEngagementRequirements({
        engagement_ref: input.engagement_ref,
        requirements: extractedRequirements,
      });
      const matched = await getStore().runRequirementMatch({
        engagement_ref: input.engagement_ref,
        vehicle_model_id: input.vehicle_model_id,
      });
      if (matched.candidates.length > 0) {
        const top = matched.candidates[0];
        const matchedVehicle =
          vehicles.find((v) => v.id === top.vehicle_model_id) ?? selectedVehicle;
        return {
          recommended_vehicle: {
            vehicle_model_id: matchedVehicle.id,
            model_code: matchedVehicle.model_code,
            type: matchedVehicle.type,
            image_url: matchedVehicle.image_url,
            reason: top.summary,
          },
          recommended_configuration: {
            source_order_id: history[0]?.order_id ?? null,
            options: recommendedOptionsFromConfig(configOptions, history[0]?.configuration_option_ids ?? []),
            configuration_option_ids: history[0]?.configuration_option_ids ?? [],
            match_reason: `Matched mandatory ${top.matched_mandatory}/${top.total_mandatory}`,
          },
          recommendations: matched.candidates.map((c) => ({
            order_id: `REQMATCH-${c.rank}`,
            rank: c.rank,
            match_reason: c.summary,
            configuration_summary: `${c.type} (${Math.round(c.match_score * 100)}% match)`,
            configuration_option_ids: [],
            unit_price_usd: null,
            date: new Date().toISOString().slice(0, 10),
          })),
          has_history: history.length > 0,
          next_actions: ["use_configuration", "generate_spec", "generate_quote"],
          intake_progress: intakeProgress,
          next_questions: intakeProgress.next_questions,
          intake_review: extracted.intake_review,
          inferred_signals: extracted.signals,
        };
      }
    }
  }

  const requestedOptions = Object.values(configOptions.categories)
    .flat()
    .filter((option) => {
      const name = option.name.toLowerCase();
      return (
        intent.includes(name) ||
        (intent.includes("protection") && name.includes("protection")) ||
        (intent.includes("level iii") && name.includes("level iii")) ||
        (intent.includes("desert") && name.includes("4wd"))
      );
    });

  const sourceOrder = history[0] ?? null;
  const sourceOptionIds = sourceOrder?.configuration_option_ids ?? [];
  const optionNamesById = new Map(
    Object.values(configOptions.categories)
      .flat()
      .map((option) => [option.id, option.name]),
  );

  const recommendedOptions = Array.from(
    new Set([
      ...sourceOptionIds.map((id) => optionNamesById.get(id) ?? id),
      ...requestedOptions.map((option) => option.name),
    ]),
  );

  return {
    recommended_vehicle: {
      vehicle_model_id: selectedVehicle.id,
      model_code: selectedVehicle.model_code,
      type: selectedVehicle.type,
      image_url: selectedVehicle.image_url,
      reason:
        "Matches the client requirement and is available in the TAG vehicle catalogue.",
    },
    recommended_configuration: {
      source_order_id: sourceOrder?.order_id ?? null,
      options: recommendedOptions,
      configuration_option_ids:
        sourceOptionIds.length > 0
          ? sourceOptionIds
          : requestedOptions.map((option) => option.id),
      match_reason: sourceOrder
        ? "Uses same-client historical configuration as the baseline, adjusted for the stated requirement."
        : "No matching past order found; uses catalogue options matched to the stated requirement.",
    },
    recommendations: history.map((order, index) => ({
      order_id: order.order_id,
      rank: index + 1,
      match_reason: "Past delivered order for same client and recommended vehicle model",
      configuration_summary: order.configuration_summary,
      configuration_option_ids: order.configuration_option_ids,
      unit_price_usd: order.unit_price_usd,
      date: order.date,
    })),
    has_history: history.length > 0,
    next_actions: ["use_configuration", "generate_spec", "generate_quote"],
    intake_progress: intakeProgress,
    next_questions: intakeProgress.next_questions,
    intake_review: extracted.intake_review,
    inferred_signals: extracted.signals,
  };
}
