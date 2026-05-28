export type Stage1FieldDefinition = {
  key: string;
  section: string;
  question: string;
  required: boolean;
};

export const STAGE1_FIELDS: Stage1FieldDefinition[] = [
  { key: "customer_organisation", section: "CUSTOMER_ENGAGEMENT", question: "Customer / Organisation?", required: true },
  { key: "country_region", section: "CUSTOMER_ENGAGEMENT", question: "Country / Region?", required: true },
  { key: "contact_name", section: "CUSTOMER_ENGAGEMENT", question: "Contact Name?", required: true },
  { key: "contact_role", section: "CUSTOMER_ENGAGEMENT", question: "Contact Title / Role?", required: true },
  { key: "date_of_engagement", section: "CUSTOMER_ENGAGEMENT", question: "Date of engagement?", required: true },
  { key: "account_manager", section: "CUSTOMER_ENGAGEMENT", question: "Account Manager?", required: true },
  { key: "opportunity_reference", section: "CUSTOMER_ENGAGEMENT", question: "Opportunity reference?", required: true },
  { key: "procurement_type", section: "CUSTOMER_ENGAGEMENT", question: "Procurement type (e.g., G2G)?", required: true },

  { key: "primary_role", section: "OPERATIONAL_CONTEXT", question: "Primary mission role?", required: true },
  { key: "secondary_role", section: "OPERATIONAL_CONTEXT", question: "Secondary role (if any)?", required: false },
  { key: "operational_theatre", section: "OPERATIONAL_CONTEXT", question: "Operational theatre?", required: true },
  { key: "threat_environment", section: "OPERATIONAL_CONTEXT", question: "Threat environment?", required: true },
  { key: "mission_duration", section: "OPERATIONAL_CONTEXT", question: "Typical mission duration?", required: false },
  { key: "vehicle_quantity", section: "OPERATIONAL_CONTEXT", question: "Number of vehicles required?", required: true },
  { key: "delivery_timeline", section: "OPERATIONAL_CONTEXT", question: "First delivery timeline requirement?", required: true },

  { key: "crew", section: "PERSONNEL_PAYLOAD", question: "Crew per vehicle?", required: true },
  { key: "dismounts", section: "PERSONNEL_PAYLOAD", question: "Dismounts per vehicle?", required: true },
  { key: "soldier_load", section: "PERSONNEL_PAYLOAD", question: "Individual soldier load?", required: false },
  { key: "medical_configuration", section: "PERSONNEL_PAYLOAD", question: "Medical configuration requirement?", required: false },
  { key: "cargo_payload", section: "PERSONNEL_PAYLOAD", question: "Cargo payload in alternate role?", required: false },

  { key: "ballistic_small_arms", section: "PROTECTION", question: "Ballistic small-arms minimum level?", required: true },
  { key: "ballistic_ap", section: "PROTECTION", question: "Ballistic armour-piercing minimum level?", required: true },
  { key: "mine_underbelly", section: "PROTECTION", question: "Mine blast underbelly requirement?", required: true },
  { key: "mine_side", section: "PROTECTION", question: "Mine blast side requirement?", required: true },
  { key: "ied_protection", section: "PROTECTION", question: "IED / VBIED requirement?", required: true },
  { key: "rpg_protection", section: "PROTECTION", question: "RPG protection requirement?", required: false },
  { key: "nbc_requirement", section: "PROTECTION", question: "NBC / CBRN requirement?", required: false },

  { key: "drive_configuration", section: "MOBILITY", question: "Drive configuration requirement?", required: true },
  { key: "max_road_speed", section: "MOBILITY", question: "Maximum road speed requirement?", required: false },
  { key: "cross_country_speed", section: "MOBILITY", question: "Cross-country speed requirement?", required: false },
  { key: "operational_range", section: "MOBILITY", question: "Operational range requirement?", required: false },
  { key: "fording_depth", section: "MOBILITY", question: "Fording depth requirement?", required: false },
  { key: "gradient", section: "MOBILITY", question: "Gradient requirement?", required: false },
  { key: "side_slope", section: "MOBILITY", question: "Side slope requirement?", required: false },
  { key: "ground_clearance", section: "MOBILITY", question: "Ground clearance requirement?", required: false },
  { key: "air_transportability", section: "MOBILITY", question: "Air transportability requirement?", required: false },

  { key: "primary_armament", section: "WEAPON_SYSTEM", question: "Primary armament preference?", required: false },
  { key: "mounting_type", section: "WEAPON_SYSTEM", question: "Mounting type preference?", required: false },
  { key: "night_capability", section: "WEAPON_SYSTEM", question: "Night/all-weather capability required?", required: false },
  { key: "smoke_dischargers", section: "WEAPON_SYSTEM", question: "Smoke grenade discharger requirement?", required: false },
  { key: "firing_ports", section: "WEAPON_SYSTEM", question: "Firing ports requirement?", required: false },

  { key: "radio_suite", section: "C4I", question: "Radio suite requirement?", required: false },
  { key: "bms_architecture", section: "C4I", question: "BMS architecture requirement?", required: false },
  { key: "gps_navigation", section: "C4I", question: "GPS / navigation requirement?", required: false },
  { key: "intercom", section: "C4I", question: "Intercom requirement?", required: false },
  { key: "antenna_provision", section: "C4I", question: "External antenna provision requirement?", required: false },
  { key: "data_bus", section: "C4I", question: "Data bus architecture requirement?", required: false },

  { key: "in_country_support", section: "LOGISTICS_SUPPORT", question: "In-country support requirement?", required: false },
  { key: "training", section: "LOGISTICS_SUPPORT", question: "Training requirement?", required: false },
  { key: "spares_holding", section: "LOGISTICS_SUPPORT", question: "Spares holding requirement?", required: false },
  { key: "documentation_language", section: "LOGISTICS_SUPPORT", question: "Documentation language requirement?", required: false },
  { key: "warranty", section: "LOGISTICS_SUPPORT", question: "Warranty requirement?", required: false },
  { key: "technology_transfer", section: "LOGISTICS_SUPPORT", question: "Technology transfer requirement?", required: false },
  { key: "mtbf", section: "LOGISTICS_SUPPORT", question: "MTBF requirement?", required: false },

  { key: "indicative_budget", section: "COMMERCIAL", question: "Indicative budget?", required: false },
  { key: "financing_requirement", section: "COMMERCIAL", question: "Financing requirement?", required: false },
  { key: "offset_requirement", section: "COMMERCIAL", question: "Offset/localisation requirement?", required: false },
  { key: "incoterms", section: "COMMERCIAL", question: "Incoterms?", required: false },
  { key: "preferred_contract_type", section: "COMMERCIAL", question: "Preferred contract type?", required: false },
];

export type Stage1FieldAnswers = Partial<Record<(typeof STAGE1_FIELDS)[number]["key"], string>>;

export type IntakeExtraction = {
  field_answers: Stage1FieldAnswers;
  intake_review: Record<string, Record<string, string | null>>;
  requirements: Array<{
    section: string;
    parameter: string;
    value_text: string;
    priority?: "MANDATORY" | "DESIRED" | "OPTIONAL";
    source?: "CUSTOMER" | "AM_ASSUMED" | "ENGINEERING_DEFAULT";
    confirmed?: boolean;
  }>;
  signals: {
    urgency: "LOW" | "MEDIUM" | "HIGH";
    confidence: "LOW" | "MEDIUM" | "HIGH";
    sentiment: "NEUTRAL" | "ASSERTIVE" | "CONCERNED";
    budget_sensitivity: "LOW" | "MEDIUM" | "HIGH";
  };
};
