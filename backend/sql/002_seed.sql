TRUNCATE TABLE
  order_quotes,
  order_specs,
  order_custom_requirements,
  order_configurations,
  orders,
  document_chunks,
  cad_metadata,
  configuration_options,
  vehicle_models,
  clients,
  account_managers
RESTART IDENTITY CASCADE;

INSERT INTO account_managers (id, name, territory, email) VALUES
  ('AM-001', 'James Okonkwo', 'MENA', 'j.okonkwo@tag.example');

INSERT INTO clients (id, name, organisation, country, am_id) VALUES
  ('CLI-UAE-MOD', 'UAE Ministry of Defence', 'UAE MOD', 'UAE', 'AM-001'),
  ('CLI-OMAN-GOV', 'Royal Oman Police', 'ROP', 'Oman', 'AM-001');

INSERT INTO vehicle_models (id, model_code, type, base_price_usd, lead_time_days, image_url) VALUES
  ('VEH-TUV-1200', 'TUV-1200', 'Tactical Utility Vehicle', 320000, 90, 'https://www.armoredcars.com/wp-content/uploads/2016/11/Right-Front-799x599.jpg'),
  ('VEH-TLC300-VR7', 'TLC-300-VR7', 'Armored Toyota Land Cruiser 300 Series', 410000, 120, 'https://www.armoredcars.com/wp-content/uploads/2022/04/TLC300-3.jpg'),
  ('VEH-ESCALADE-PPV', 'ESCALADE-PPV', 'Armored Passenger Protection SUV', 390000, 110, 'https://www.armoredcars.com/wp-content/uploads/2026/03/2024-cadillac-escalade-esv-premium-luxury-1.jpg'),
  ('VEH-CIT-350', 'CIT-350', 'Cash-in-Transit Vehicle', 275000, 100, 'https://www.armoredcars.com/wp-content/uploads/2022/02/cash-in-transit.jpg'),
  ('VEH-APC-BATT', 'BATT-APC', 'Armored Personnel Carrier', 620000, 150, 'https://www.armoredcars.com/wp-content/uploads/2026/03/batt-apex-1.webp'),
  ('VEH-BATT-IFV', 'BATT-IFV', 'Infantry Fighting Vehicle', 780000, 180, 'https://www.armoredcars.com/wp-content/uploads/2026/03/batt-apex-1.webp'),
  ('VEH-LD1-POLARIS', 'LD-1-POLARIS', 'Armored Polaris ATV', 145000, 75, 'https://www.armoredcars.com/wp-content/uploads/2024/04/MAIN-IMAGE.jpg');

INSERT INTO configuration_options (id, vehicle_model_id, category, option_name, add_on_price_usd) VALUES
  ('opt-4wd', 'VEH-TUV-1200', 'Drive', '4WD', 0),
  ('opt-diesel', 'VEH-TUV-1200', 'Engine', 'Diesel 2.4L', 0),
  ('opt-long-wb', 'VEH-TUV-1200', 'Wheelbase', 'Long WB', 12000),
  ('opt-level3', 'VEH-TUV-1200', 'Protection', 'Level III Protection', 45000),
  ('opt-vr7', 'VEH-TLC300-VR7', 'Protection', 'VPAM VR7 Armoring', 85000),
  ('opt-runflat', 'VEH-TLC300-VR7', 'Mobility', 'Run Flat Tires', 6000),
  ('opt-luxury-cabin', 'VEH-ESCALADE-PPV', 'Interior', 'Executive Protection Interior', 25000),
  ('opt-ballistic-glass', 'VEH-ESCALADE-PPV', 'Protection', 'Certified Ballistic Glass', 30000),
  ('opt-cash-safe', 'VEH-CIT-350', 'Cargo', 'Secure Cash Compartment', 18000),
  ('opt-cit-camera', 'VEH-CIT-350', 'Security', 'CCTV and GPS Tracking', 12000),
  ('opt-troop-seats', 'VEH-APC-BATT', 'Interior', 'Troop Transport Seating', 40000),
  ('opt-blast-floor', 'VEH-APC-BATT', 'Protection', 'Blast Protected Floor', 95000),
  ('opt-ifv-turret', 'VEH-BATT-IFV', 'Armament', 'Remote Weapon Station Provision', 120000),
  ('opt-ifv-troop', 'VEH-BATT-IFV', 'Interior', 'Infantry Squad Compartment', 55000),
  ('opt-atv-armor', 'VEH-LD1-POLARIS', 'Protection', 'Lightweight Armor Kit', 32000),
  ('opt-offroad-kit', 'VEH-LD1-POLARIS', 'Mobility', 'Off-road Patrol Kit', 14000);

INSERT INTO orders (id, client_id, am_id, vehicle_model_id, qty, status, created_at) VALUES
  ('ORD-2025-019', 'CLI-UAE-MOD', 'AM-001', 'VEH-TUV-1200', 12, 'Delivered', '2025-07-22'::timestamptz),
  ('ORD-2025-044', 'CLI-UAE-MOD', 'AM-001', 'VEH-APC-BATT', 4, 'Client Approved', '2025-11-08'::timestamptz);

INSERT INTO order_configurations (order_id, option_id) VALUES
  ('ORD-2025-019', 'opt-4wd'),
  ('ORD-2025-019', 'opt-diesel'),
  ('ORD-2025-019', 'opt-long-wb'),
  ('ORD-2025-019', 'opt-level3'),
  ('ORD-2025-044', 'opt-troop-seats'),
  ('ORD-2025-044', 'opt-blast-floor');

INSERT INTO orders (id, client_id, am_id, vehicle_model_id, qty, status) VALUES
  ('ORD-2026-POC', 'CLI-UAE-MOD', 'AM-001', 'VEH-TUV-1200', 10, 'Draft');

INSERT INTO order_configurations (order_id, option_id) VALUES
  ('ORD-2026-POC', 'opt-4wd'),
  ('ORD-2026-POC', 'opt-level3');

INSERT INTO order_custom_requirements (order_id, delivery, compliance, notes) VALUES
  ('ORD-2026-POC', 'Abu Dhabi — FOB', 'MIL-STD-461G EMC compliance', 'RAL 7013 exterior paint on all external metalwork.');

INSERT INTO cad_metadata (vehicle_model_id, model_code, bom_reference, drawing_set_reference, weight_kg, length_mm, width_mm, height_mm) VALUES
  ('VEH-TUV-1200', 'TUV-1200', 'BOM-TUV-1200-v3.2', 'DWG-TUV-1200-PROD-v3.2', 2840, 5200, 2100, 1980),
  ('VEH-TLC300-VR7', 'TLC-300-VR7', 'BOM-TLC300-VR7-demo', 'DWG-TLC300-VR7-demo', 3650, 4980, 1980, 1950),
  ('VEH-ESCALADE-PPV', 'ESCALADE-PPV', 'BOM-ESCALADE-PPV-demo', 'DWG-ESCALADE-PPV-demo', 3900, 5380, 2060, 1940),
  ('VEH-CIT-350', 'CIT-350', 'BOM-CIT-350-demo', 'DWG-CIT-350-demo', 4200, 6100, 2200, 2550),
  ('VEH-APC-BATT', 'BATT-APC', 'BOM-BATT-APC-demo', 'DWG-BATT-APC-demo', 7800, 6500, 2450, 2800),
  ('VEH-BATT-IFV', 'BATT-IFV', 'BOM-BATT-IFV-demo', 'DWG-BATT-IFV-demo', 8200, 6700, 2500, 2850),
  ('VEH-LD1-POLARIS', 'LD-1-POLARIS', 'BOM-LD1-POLARIS-demo', 'DWG-LD1-POLARIS-demo', 980, 3500, 1700, 1900);

INSERT INTO document_chunks (vehicle_model_id, chunk_text, chunk_index) VALUES
  ('VEH-TUV-1200', 'Level III protection includes ballistic steel floor and side panels per TAG BS-TAG-PROT-03.', 0),
  ('VEH-TUV-1200', 'Long wheelbase required for 1800kg payload rating on TUV-1200 platform.', 1),
  ('VEH-TUV-1200', 'TAG engineering doctrine for armored utility vehicles emphasizes firewall protection, upgraded suspension, brake upgrades, and run-flat mobility to maintain control under increased armor mass.', 2),
  ('VEH-TUV-1200', 'TAG manufacturing principles require balancing payload and protection package selection against route profile, terrain, and serviceability windows before release to production.', 3),
  ('VEH-TUV-1200', 'TAG quality baseline highlights FMVSS-aligned build practice, ballistic-tested protection architecture, and maintainable integration for field support.', 4),
  ('VEH-APC-BATT', 'Armored personnel carrier package includes troop transport seating and blast protected flooring.', 0),
  ('VEH-APC-BATT', 'TAG BATT family references describe mission-ready APC architecture with optional roof hatches, turret configurations, and tactical systems integration for military and law-enforcement operations.', 1),
  ('VEH-APC-BATT', 'TAG protection design examples include blast mitigating flooring, armored firewall strategy, roof protection, and door overlap coverage to reduce weak-point exposure.', 2),
  ('VEH-APC-BATT', 'TAG doctrine for armored tactical carriers emphasizes suspension and brake upgrades to preserve handling after armor integration and support high-confidence deployment.', 3),
  ('VEH-APC-BATT', 'TAG standards context references multi-framework armor options (NIJ/CEN/VPAM) selected based on mission threat model and regional compliance requirements.', 4),
  ('VEH-BATT-IFV', 'Infantry fighting vehicle package supports remote weapon station provision and infantry squad compartment layout.', 0),
  ('VEH-BATT-IFV', 'TAG BATT APEX references describe next-generation tactical armored platform objectives: survivability, mobility, and operational flexibility for defense and security missions.', 1),
  ('VEH-BATT-IFV', 'BATT APEX profile highlights 6.7L V8 turbo diesel, 10-speed transmission, selectable 4x4, high ground clearance, and run-flat mobility as mission-continuity controls.', 2),
  ('VEH-BATT-IFV', 'Operational deployment references include troop transport, border security, and special response support with configurable payload systems and mission equipment.', 3),
  ('VEH-BATT-IFV', 'Engineering integration notes for IFV-class builds include turret/surveillance preparation, electrical load planning, and validation of armor-package interactions before handover.', 4),
  ('VEH-BATT-IFV', 'TAG ballistic and certification references stress laboratory-tested armor and glass strategy, with configurable protection programs across NIJ, CEN, and VPAM schemes.', 5),
  ('VEH-CIT-350', 'Cash-in-transit vehicles require secure cash compartments, CCTV, GPS tracking, and crew protection.', 0),
  ('VEH-CIT-350', 'TAG cash-in-transit program context prioritizes compartment security, route reliability, and integrated surveillance for high-value cargo operations.', 1),
  ('VEH-CIT-350', 'CIT engineering release should verify secure compartment controls, CCTV/GPS continuity, and protected crew workflow across stop-and-go urban deployment patterns.', 2),
  ('VEH-TLC300-VR7', 'TLC 300 VR7 package references certified ballistic glass, run flat tires, and VPAM VR7 protection.', 0);
