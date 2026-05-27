/** In-memory fixture data — used when USE_MEMORY_STORE=true (tests). Production uses Supabase. */

export const clients = [
  { id: "CLI-UAE-MOD", name: "UAE Ministry of Defence", country: "UAE" },
  { id: "CLI-OMAN-GOV", name: "Royal Oman Police", country: "Oman" },
];

export const vehicles = [
  {
    id: "VEH-TUV-1200",
    model_code: "TUV-1200",
    type: "Tactical Utility Vehicle",
    base_price_usd: 320000,
    lead_time_days: 90,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2016/11/Right-Front-799x599.jpg",
  },
  {
    id: "VEH-TLC300-VR7",
    model_code: "TLC-300-VR7",
    type: "Armored Toyota Land Cruiser 300 Series",
    base_price_usd: 410000,
    lead_time_days: 120,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2022/04/TLC300-3.jpg",
  },
  {
    id: "VEH-ESCALADE-PPV",
    model_code: "ESCALADE-PPV",
    type: "Armored Passenger Protection SUV",
    base_price_usd: 390000,
    lead_time_days: 110,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2026/03/2024-cadillac-escalade-esv-premium-luxury-1.jpg",
  },
  {
    id: "VEH-CIT-350",
    model_code: "CIT-350",
    type: "Cash-in-Transit Vehicle",
    base_price_usd: 275000,
    lead_time_days: 100,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2022/02/cash-in-transit.jpg",
  },
  {
    id: "VEH-APC-BATT",
    model_code: "BATT-APC",
    type: "Armored Personnel Carrier",
    base_price_usd: 620000,
    lead_time_days: 150,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2026/03/batt-apex-1.webp",
  },
  {
    id: "VEH-BATT-IFV",
    model_code: "BATT-IFV",
    type: "Infantry Fighting Vehicle",
    base_price_usd: 780000,
    lead_time_days: 180,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2026/03/batt-apex-1.webp",
  },
  {
    id: "VEH-LD1-POLARIS",
    model_code: "LD-1-POLARIS",
    type: "Armored Polaris ATV",
    base_price_usd: 145000,
    lead_time_days: 75,
    image_url: "https://www.armoredcars.com/wp-content/uploads/2024/04/MAIN-IMAGE.jpg",
  },
];

export const options = [
  { id: "opt-4wd", vehicle_model_id: "VEH-TUV-1200", name: "4WD", category: "Drive", add_on_price_usd: 0 },
  { id: "opt-diesel", vehicle_model_id: "VEH-TUV-1200", name: "Diesel 2.4L", category: "Engine", add_on_price_usd: 0 },
  {
    id: "opt-long-wb",
    vehicle_model_id: "VEH-TUV-1200",
    name: "Long WB",
    category: "Wheelbase",
    add_on_price_usd: 12000,
  },
  {
    id: "opt-level3",
    vehicle_model_id: "VEH-TUV-1200",
    name: "Level III Protection",
    category: "Protection",
    add_on_price_usd: 45000,
  },
  { id: "opt-vr7", vehicle_model_id: "VEH-TLC300-VR7", name: "VPAM VR7 Armoring", category: "Protection", add_on_price_usd: 85000 },
  { id: "opt-runflat", vehicle_model_id: "VEH-TLC300-VR7", name: "Run Flat Tires", category: "Mobility", add_on_price_usd: 6000 },
  { id: "opt-luxury-cabin", vehicle_model_id: "VEH-ESCALADE-PPV", name: "Executive Protection Interior", category: "Interior", add_on_price_usd: 25000 },
  { id: "opt-ballistic-glass", vehicle_model_id: "VEH-ESCALADE-PPV", name: "Certified Ballistic Glass", category: "Protection", add_on_price_usd: 30000 },
  { id: "opt-cash-safe", vehicle_model_id: "VEH-CIT-350", name: "Secure Cash Compartment", category: "Cargo", add_on_price_usd: 18000 },
  { id: "opt-cit-camera", vehicle_model_id: "VEH-CIT-350", name: "CCTV and GPS Tracking", category: "Security", add_on_price_usd: 12000 },
  { id: "opt-troop-seats", vehicle_model_id: "VEH-APC-BATT", name: "Troop Transport Seating", category: "Interior", add_on_price_usd: 40000 },
  { id: "opt-blast-floor", vehicle_model_id: "VEH-APC-BATT", name: "Blast Protected Floor", category: "Protection", add_on_price_usd: 95000 },
  { id: "opt-ifv-turret", vehicle_model_id: "VEH-BATT-IFV", name: "Remote Weapon Station Provision", category: "Armament", add_on_price_usd: 120000 },
  { id: "opt-ifv-troop", vehicle_model_id: "VEH-BATT-IFV", name: "Infantry Squad Compartment", category: "Interior", add_on_price_usd: 55000 },
  { id: "opt-atv-armor", vehicle_model_id: "VEH-LD1-POLARIS", name: "Lightweight Armor Kit", category: "Protection", add_on_price_usd: 32000 },
  { id: "opt-offroad-kit", vehicle_model_id: "VEH-LD1-POLARIS", name: "Off-road Patrol Kit", category: "Mobility", add_on_price_usd: 14000 },
];

export const pastOrders = [
  {
    order_id: "ORD-2025-019",
    client_id: "CLI-UAE-MOD",
    vehicle_model_id: "VEH-TUV-1200",
    date: "2025-07-22",
    qty: 12,
    status: "Delivered",
    configuration_summary: "4WD, Diesel 2.4L, Long WB, Level III",
    configuration_option_ids: [
      "opt-4wd",
      "opt-diesel",
      "opt-long-wb",
      "opt-level3",
    ],
    unit_price_usd: 377000,
  },
  {
    order_id: "ORD-2025-044",
    client_id: "CLI-UAE-MOD",
    vehicle_model_id: "VEH-APC-BATT",
    date: "2025-11-08",
    qty: 4,
    status: "Client Approved",
    configuration_summary: "BATT-APC, Troop Transport Seating, Blast Protected Floor",
    configuration_option_ids: ["opt-troop-seats", "opt-blast-floor"],
    unit_price_usd: 755000,
  },
];

export const customRequirements: Record<
  string,
  { delivery: string; compliance: string; notes: string }
> = {
  "ORD-2026-POC": {
    delivery: "Abu Dhabi — FOB",
    compliance: "MIL-STD-461G EMC compliance",
    notes: "RAL 7013 exterior paint on all external metalwork.",
  },
};

export const buildBookChunks = [
  {
    vehicle_model_id: "VEH-TUV-1200",
    text: "Level III protection includes ballistic steel floor and side panels per TAG BS-TAG-PROT-03.",
  },
  {
    vehicle_model_id: "VEH-TUV-1200",
    text: "Long wheelbase required for 1800kg payload rating on TUV-1200 platform.",
  },
];

export const cadMetadata = {
  vehicle_model_id: "VEH-TUV-1200",
  model_code: "TUV-1200",
  bom_reference: "BOM-TUV-1200-v3.2",
  drawing_set_reference: "DWG-TUV-1200-PROD-v3.2",
  weight_kg: 2840,
  length_mm: 5200,
  width_mm: 2100,
  height_mm: 1980,
};
