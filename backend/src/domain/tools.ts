import { getStore } from "../data/index.js";

export async function searchPastOrders(
  client_id: string,
  vehicle_model_id: string,
  limit = 3,
) {
  return getStore().searchPastOrders(client_id, vehicle_model_id, limit);
}

export async function getVehicleModel(vehicle_model_id: string) {
  return getStore().getVehicleModel(vehicle_model_id);
}

export async function listVehicleModels() {
  return getStore().listVehicles();
}

export async function getConfigurationOptions(vehicle_model_id: string) {
  return getStore().getConfigurationOptions(vehicle_model_id);
}

export async function recommendFromClientIntent(input: {
  client_id: string;
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
  };
}

function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[\s-_]/g, "");
}

/** Match explicit catalogue model codes in user text; "unknown" if they asked for a code we do not list. */
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

function scoreVehicleForIntent(
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

export async function getCustomRequirements(order_id: string) {
  return getStore().getCustomRequirements(order_id);
}

export async function searchBuildContext(
  query: string,
  vehicle_model_id: string,
  limit = 3,
) {
  const expandedQuery = query.toLowerCase();
  const hints = [
    query,
    "protection",
    "blast",
    "run-flat",
    "suspension",
    "engineering",
    "integration",
    "validation",
    "mission",
    "mobility",
    "compliance",
  ];

  const searched = await Promise.all(
    hints.map((q) => getStore().searchBuildContext(q, vehicle_model_id, Math.ceil(limit / 2))),
  );

  const merged = searched
    .flat()
    .map((r) => r.text)
    .filter(Boolean)
    .filter((text, i, arr) => arr.indexOf(text) === i);

  const ranked = merged.sort((a, b) => {
    const as = scoreContextChunk(a, expandedQuery);
    const bs = scoreContextChunk(b, expandedQuery);
    return bs - as;
  });

  return ranked.slice(0, Math.max(limit, 8)).map((text) => ({ text }));
}

function scoreContextChunk(text: string, query: string): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const token of query.split(/\s+/).filter((x) => x.length > 2)) {
    if (t.includes(token)) score += 3;
  }
  for (const token of [
    "protection",
    "blast",
    "suspension",
    "run-flat",
    "validation",
    "integration",
    "mission",
    "mobility",
    "compliance",
  ]) {
    if (t.includes(token)) score += 1;
  }
  return score;
}

export async function getCadMetadata(vehicle_model_id: string) {
  return getStore().getCadMetadata(vehicle_model_id);
}

export async function calculateQuoteLineItems(input: {
  vehicle_model_id: string;
  configuration_option_ids: string[];
  qty: number;
}) {
  const vehicle = await getVehicleModel(input.vehicle_model_id);
  if (!vehicle) {
    throw new Error(`Unknown vehicle model: ${input.vehicle_model_id}`);
  }

  const prices = await getStore().getOptionPrices(input.configuration_option_ids);
  let optionsSubtotal = 0;
  for (const id of input.configuration_option_ids) {
    const price = prices.get(id);
    if (price === undefined) throw new Error(`Unknown option: ${id}`);
    optionsSubtotal += price;
  }

  const unit_price = vehicle.base_price_usd + optionsSubtotal;
  const subtotal = unit_price * input.qty;

  return {
    base_price: vehicle.base_price_usd,
    options_subtotal: optionsSubtotal,
    unit_price,
    qty: input.qty,
    subtotal,
    total_usd: subtotal,
    lead_time_days: vehicle.lead_time_days,
  };
}

export async function generateEngineeringOutput(input: {
  order_id: string;
  vehicle_model_id: string;
  configuration_option_ids: string[];
}) {
  const [vehicle, configOptions, custom, cad, buildContext] = await Promise.all([
    getVehicleModel(input.vehicle_model_id),
    getConfigurationOptions(input.vehicle_model_id),
    getCustomRequirements(input.order_id),
    getCadMetadata(input.vehicle_model_id),
    searchBuildContext("Level III", input.vehicle_model_id, 3),
  ]);

  if (!vehicle) {
    throw new Error(`Unknown vehicle model: ${input.vehicle_model_id}`);
  }

  const configuration_requirements = input.configuration_option_ids.map((id) => {
    const category = Object.entries(configOptions.categories).find(([, rows]) =>
      rows.some((row) => row.id === id),
    )?.[0];
    const option = category
      ? configOptions.categories[category].find((row) => row.id === id)
      : null;

    return {
      option_id: id,
      category: category ?? "Configuration",
      option_name: option?.name ?? id,
      engineering_note: "Verify selected option against approved vehicle spec.",
    };
  });

  const compliance_requirements = [
    custom.compliance
      ? {
          source: "custom_requirements",
          requirement: custom.compliance,
        }
      : null,
  ].filter(Boolean);

  const custom_build_notes = [
    custom.delivery ? `Delivery terms: ${custom.delivery}` : null,
    custom.notes,
  ].filter(Boolean);

  const capability = await buildVehicleCapabilityContext({
    vehicle_model_id: input.vehicle_model_id,
    configuration_option_ids: input.configuration_option_ids,
    order_id: input.order_id,
  });

  const manufacturing_work_packages = [
    {
      package_id: "WP-CHASSIS-001",
      workstream: "Chassis and protection integration",
      scope: "Integrate selected protection and structural reinforcements onto host platform.",
      dependencies: ["Approved configuration options", "BOM release"],
    },
    {
      package_id: "WP-SYSTEMS-002",
      workstream: "Electrical and mission systems integration",
      scope: "Install and validate mission-system harnesses, comms, and optional payload interfaces.",
      dependencies: ["System architecture review", "Power budget sign-off"],
    },
    {
      package_id: "WP-QA-003",
      workstream: "Final validation and release readiness",
      scope: "Execute quality checks, mobility verification, and documentation sign-off.",
      dependencies: ["Assembly complete", "Compliance checklist complete"],
    },
  ];

  const quality_and_verification_plan = [
    {
      check: "Protection package conformance",
      method: "Inspection against approved option and protection matrix",
      acceptance: "All installed materials and overlaps match approved BOM and layout",
    },
    {
      check: "Door/closure and hinge load behavior",
      method: "Functional cycle testing under armored mass",
      acceptance: "No binding or structural stress anomalies",
    },
    {
      check: "Mobility and braking baseline",
      method: "Controlled road/off-road verification route",
      acceptance: "Vehicle meets platform handling and stopping performance thresholds",
    },
    {
      check: "Electrical load and mission system validation",
      method: "Power-on diagnostics and subsystem integration test",
      acceptance: "No faults; all mission-critical systems operational",
    },
    {
      check: "Documentation release package",
      method: "Engineering document cross-check (BOM, drawing set, configuration notes)",
      acceptance: "Complete and revision-consistent release pack",
    },
  ];

  const integration_interfaces = capability.integration_profile.slice(0, 3).map((note, i) => ({
    system: i === 0 ? "Power and electrical" : i === 1 ? "Mechanical integration" : "Mission systems",
    interface_note: note,
    risk: "Requires cross-team sign-off before production release",
  }));

  return {
    engineering_package: {
      order_id: input.order_id,
      vehicle_model: vehicle.model_code,
      vehicle_type: vehicle.type,
      bom_reference:
        (cad?.bom_reference as string | undefined) ?? null,
      drawing_set_reference:
        (cad?.drawing_set_reference as string | undefined) ?? null,
      configuration_requirements,
      compliance_requirements,
      custom_build_notes,
      build_context_references: buildContext.map((row) => row.text),
      manufacturing_work_packages,
      quality_and_verification_plan,
      integration_interfaces,
      safety_critical_notes: capability.protection_profile,
      open_questions: [],
      handover_status: "ready_for_engineering",
    },
  };
}

type VehicleCapabilityProfile = {
  mission_roles: string[];
  protection_profile: string[];
  mobility_profile: string[];
  systems_profile: string[];
  integration_profile: string[];
  source_refs: string[];
};

const TAG_CAPABILITY_MAP: Record<string, VehicleCapabilityProfile> = {
  "VEH-BATT-IFV": {
    mission_roles: [
      "Infantry transport and rapid deployment in high-threat zones",
      "Border security patrol and urban response support",
      "Command-and-control escort profile when configured with comms kit",
    ],
    protection_profile: [
      "Armoring strategy aligned to multi-standard programs (NIJ / CEN / VPAM program tailoring)",
      "Blast and ballistic survivability emphasis for crew compartment and floor architecture",
      "Run-flat mobility retention requirement for post-contact extraction",
    ],
    mobility_profile: [
      "Heavy tactical diesel drivetrain class with 4x4 mission profile",
      "High-ground-clearance off-road doctrine and mixed urban/off-road operation",
      "Suspension and brake upgrades expected to compensate armor mass growth",
    ],
    systems_profile: [
      "Remote weapon station preparation for mission payload integration",
      "Surveillance and situational-awareness package integration pathway",
      "Crew ergonomics and troop compartment layout for sustained deployments",
    ],
    integration_profile: [
      "Electrical and comms harness reservations for mission kits",
      "Modular fit-out approach to support country-specific doctrine",
      "Configuration changes must preserve certified protection envelope",
    ],
    source_refs: [
      "TAG BATT APEX page: multi-role deployment, STANAG-oriented protection narrative, 6.7L diesel/10-speed/4x4 mission profile",
      "TAG BATT family pages (BATT-X/BATT-T/BATT-XL): protection architecture, turret/roof hatch options, tactical team deployment fit",
      "TAG certifications + armor standards pages: NIJ/CEN/VPAM framing for ballistic program selection",
    ],
  },
  "VEH-APC-BATT": {
    mission_roles: [
      "Armored personnel carrier mission for tactical unit transport",
      "Special response and convoy support deployment profile",
      "Internal security operations with configurable crew seating",
    ],
    protection_profile: [
      "Ballistic cabin design with roof/firewall/floor protection focus",
      "Blast mitigation floor requirement in full protection package",
      "Door overlap and gap-protection doctrine in high-risk scenarios",
    ],
    mobility_profile: [
      "4x4 mobility with armored mass compensation through suspension/brake upgrades",
      "Rural and urban maneuverability for tactical insertion routes",
      "Run-flat and tire survivability strategy under contact conditions",
    ],
    systems_profile: [
      "Roof hatch and optional turret integration profile",
      "Emergency lighting/siren and tactical communications pathway",
      "Operator safety ergonomics for fully geared troop movements",
    ],
    integration_profile: [
      "Scalable armor package by threat profile and region",
      "Mission-role conversion options (transport, command support, medical support)",
      "Maintainability and service access as engineering handover checkpoint",
    ],
    source_refs: [
      "TAG BATT family pages (BATT-T/BATT-X/BATT-XL): core APC mission and protection package details",
      "TAG ballistic standards matrices: B-level framework and selectable threat envelopes",
    ],
  },
  "VEH-LD1-POLARIS": {
    mission_roles: [
      "Rapid patrol and point-response in tight-space environments",
      "High-mobility security support for mixed terrain patrols",
      "Quick insertion ballistic shield platform for first responders",
    ],
    protection_profile: [
      "NIJ III/B6 rifle-rated operator protection profile",
      "360-degree operator protection envelope in lightweight architecture",
      "Replaceable armor panel strategy for operational lifecycle support",
    ],
    mobility_profile: [
      "Polaris Sportsman 850-based maneuverability and light-weight response",
      "All-terrain / all-weather deployment profile",
      "Fast deployment emphasis over heavy payload doctrine",
    ],
    systems_profile: [
      "Modular armored body removable/reinstallable on host chassis",
      "Operational fit for patrol, perimeter security, and agile response",
      "Rural/urban navigation constraints addressed in narrow access paths",
    ],
    integration_profile: [
      "Field-replaceable protection components reduce downtime",
      "Platform should retain serviceability on base ATV ecosystem",
      "Accessory integration must preserve rider protection sightlines",
    ],
    source_refs: [
      "TAG Armored Polaris ATV LD-1 page: NIJ III profile, 360-degree operator protection, replaceable/removable armor body",
      "TAG product overview: tactical deployment and rapid-response usage context",
    ],
  },
  "VEH-ESCALADE-PPV": {
    mission_roles: [
      "Executive / VIP transport under elevated threat conditions",
      "Secure urban movement with discreet protection posture",
      "Government and corporate protective operations",
    ],
    protection_profile: [
      "CEN BR6-class package profile for rifle-threat baseline",
      "Door pillars, bulkhead, firewall, roof, floor, and glass reinforcement doctrine",
      "Ballistic overlap architecture to reduce weak-point exposure",
    ],
    mobility_profile: [
      "Road-biased armored SUV platform tuned for protected mobility",
      "Door hinge and frame reinforcement for armored mass durability",
      "Brake/suspension adaptation implied by protection package weight",
    ],
    systems_profile: [
      "Executive protection interior and mission communication fit-outs",
      "Transparent armor integration with OEM profile retention",
      "Crew comfort and endurance features for long escort missions",
    ],
    integration_profile: [
      "Armor package configurable by threat model and region",
      "Protection upgrades must preserve OEM drivability and safety systems",
      "Glass/steel harmonization is a critical validation checkpoint",
    ],
    source_refs: [
      "TAG Escalade armored listings: BR6 profile and reinforced structural protection scope",
      "TAG certifications page: ballistic glass and steel test/certification framing",
    ],
  },
  "VEH-CIT-350": {
    mission_roles: [
      "Cash-in-transit route security operations",
      "High-value cargo protection and controlled transfer points",
      "Crew-protected transport in urban threat environments",
    ],
    protection_profile: [
      "Crew compartment and cargo-zone protection partitioning",
      "Security package alignment for anti-intrusion and ballistic defense",
      "Operational survivability for planned urban routes",
    ],
    mobility_profile: [
      "Commercial armored van/truck profile with route reliability priority",
      "Urban stop-and-go resilience and braking reliability requirements",
      "Payload-protection balance for secure compartment architecture",
    ],
    systems_profile: [
      "CCTV/GPS tracking as standard mission-control layer",
      "Secure cash compartment and access control requirement",
      "Crew workflow integration between security and transport tasks",
    ],
    integration_profile: [
      "Telematics and surveillance retention in electrical architecture",
      "Compartment hardening and access protocol validation",
      "Maintenance plan should include security subsystem checks",
    ],
    source_refs: [
      "TAG homepage + CIT category positioning: dedicated cash-in-transit mission focus",
      "Seeded TAG option set: secure cash compartment + CCTV/GPS track package",
    ],
  },
  "VEH-TUV-1200": {
    mission_roles: [
      "Utility patrol and tactical support operations",
      "Mixed-use government fleet deployment",
      "Transport and mission kit support in varied terrain",
    ],
    protection_profile: [
      "Configurable protection package with Level III selection path",
      "Floor/side ballistic protection references in build context",
      "Client compliance-driven protection tailoring process",
    ],
    mobility_profile: [
      "4WD + diesel utility profile with long-wheelbase payload variant",
      "Fleet-oriented reliability and maintainability emphasis",
      "Urban-to-desert operational adaptation via configuration options",
    ],
    systems_profile: [
      "Configuration-driven architecture for mission-specific fit-outs",
      "Reference CAD/BOM linkage for manufacturing continuity",
      "Compliance-led integration checkpoints for regional requirements",
    ],
    integration_profile: [
      "Build-context references must be carried into specification package",
      "Option interactions should be validated before engineering handover",
      "Lead-time and payload implications captured in quote/spec flow",
    ],
    source_refs: [
      "Seeded build-book references: Level III floor/side protection and long-wheelbase payload context",
      "TAG utility/tactical product positioning from catalog categories",
    ],
  },
};

function getCapabilityProfile(vehicle_model_id: string): VehicleCapabilityProfile {
  return (
    TAG_CAPABILITY_MAP[vehicle_model_id] ?? {
      mission_roles: ["General protected mobility mission profile"],
      protection_profile: ["Configurable ballistic and blast protection profile"],
      mobility_profile: ["All-terrain tactical mobility profile"],
      systems_profile: ["Mission-kit and communications integration profile"],
      integration_profile: ["Engineering validation and maintainability checkpoints"],
      source_refs: ["TAG vehicle category and certification references"],
    }
  );
}

export async function buildVehicleCapabilityContext(input: {
  vehicle_model_id: string;
  configuration_option_ids?: string[];
  order_id?: string;
}) {
  const [vehicle, options, custom] = await Promise.all([
    getVehicleModel(input.vehicle_model_id),
    getConfigurationOptions(input.vehicle_model_id),
    input.order_id ? getCustomRequirements(input.order_id) : Promise.resolve(null),
  ]);

  if (!vehicle) {
    throw new Error(`Unknown vehicle model: ${input.vehicle_model_id}`);
  }

  const selected = new Set(input.configuration_option_ids ?? []);
  const selected_options = Object.entries(options.categories)
    .flatMap(([category, rows]) =>
      rows
        .filter((row) => selected.size === 0 || selected.has(row.id))
        .map((row) => ({
          option_id: row.id,
          category,
          option_name: row.name,
          add_on_price_usd: row.add_on_price,
        })),
    );

  const profile = getCapabilityProfile(input.vehicle_model_id);
  return {
    vehicle: {
      vehicle_model_id: vehicle.id,
      model_code: vehicle.model_code,
      type: vehicle.type,
      base_price_usd: vehicle.base_price_usd,
      lead_time_days: vehicle.lead_time_days,
      image_url: vehicle.image_url,
    },
    selected_options,
    mission_roles: profile.mission_roles,
    protection_profile: profile.protection_profile,
    mobility_profile: profile.mobility_profile,
    systems_profile: profile.systems_profile,
    integration_profile: profile.integration_profile,
    source_refs: profile.source_refs,
    order_custom_requirements: custom,
  };
}

export async function persistAgentOutput(
  mode: string,
  order_id: string | undefined,
  result: unknown,
): Promise<string | null> {
  if (!order_id) return null;

  const store = getStore();
  if (mode === "generate_spec") {
    return store.saveSpec(order_id, result);
  }
  if (mode === "generate_quote") {
    const quote = result as {
      total_usd?: number;
      line_items?: Array<{ unit_price_usd?: number }>;
    };
    return store.saveQuote(
      order_id,
      result,
      quote.line_items?.[0]?.unit_price_usd ?? null,
      quote.total_usd ?? null,
    );
  }
  return null;
}
