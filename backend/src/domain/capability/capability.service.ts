import { getVehicleModel, getConfigurationOptions } from "../vehicle/vehicle.service.js";
import { getCustomRequirements } from "../engagement/engagement.service.js";

export type VehicleCapabilityProfile = {
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
