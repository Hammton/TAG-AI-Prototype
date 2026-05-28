-- TAG procurement seed (stable UUIDs for vehicle_class / vehicle_model)

-- vehicle_class (fixed UUIDs)
INSERT INTO vehicle_class (id, code, label, spec_template, stage1_questions, stage3_sections) VALUES
  ('a1000001-0001-4001-8001-000000000001', 'CIT', 'Cash-in-Transit',
    '{"sections":[{"code":"PROTECTION","title":"Protection","depth":"FULL"}]}'::jsonb,
    '[{"id":"q_mission","section":"OPERATIONAL","prompt":"Primary route profile?","type":"text","mandatory":true}]'::jsonb,
    '{"PROTECTION":"FULL","MOBILITY":"MODERATE","C4I":"LIGHT"}'::jsonb),
  ('a1000001-0001-4001-8001-000000000002', 'APC', 'Armoured Personnel Carrier',
    '{"sections":[{"code":"PROTECTION","title":"Protection & Survivability","depth":"FULL"}]}'::jsonb,
    '[{"id":"q_crew","section":"OPERATIONAL","prompt":"Troop capacity required?","type":"number","mandatory":true}]'::jsonb,
    '{"PROTECTION":"FULL","WEAPON":"MODERATE","MOBILITY":"FULL"}'::jsonb),
  ('a1000001-0001-4001-8001-000000000003', 'PPV', 'Passenger Protection Vehicle',
    '{"sections":[{"code":"PROTECTION","title":"Protection","depth":"FULL"}]}'::jsonb,
    '[{"id":"q_threat","section":"PROTECTION","prompt":"Ballistic certification target?","type":"text","mandatory":true}]'::jsonb,
    '{"PROTECTION":"FULL","CREW":"MODERATE"}'::jsonb),
  ('a1000001-0001-4001-8001-000000000004', 'MILITARY', 'Military Tactical',
    '{"sections":[{"code":"PROTECTION","title":"Protection","depth":"FULL"},{"code":"WEAPON","title":"Weapon Systems","depth":"FULL"}]}'::jsonb,
    '[{"id":"q_stanag","section":"PROTECTION","prompt":"STANAG ballistic level?","type":"single_select","options":["2","3","4"],"mandatory":true}]'::jsonb,
    '{"PROTECTION":"FULL","WEAPON":"FULL","TESTING":"FULL"}'::jsonb),
  ('a1000001-0001-4001-8001-000000000005', 'LE', 'Law Enforcement / Utility',
    '{"sections":[{"code":"MOBILITY","title":"Mobility","depth":"MODERATE"}]}'::jsonb,
    '[{"id":"q_patrol","section":"OPERATIONAL","prompt":"Patrol environment?","type":"text","mandatory":false}]'::jsonb,
    '{"PROTECTION":"MODERATE","MOBILITY":"MODERATE"}'::jsonb);

INSERT INTO protection_standard (id, code, framework, threat_type, test_procedure) VALUES
  ('b2000001-0001-4001-8001-000000000001', 'NIJ_III', 'NIJ', 'BALLISTIC', '{"ref":"NIJ 0108.01"}'::jsonb),
  ('b2000001-0001-4001-8001-000000000002', 'STANAG_L2', 'STANAG', 'BALLISTIC', '{"ref":"AEP-55 Vol 1"}'::jsonb),
  ('b2000001-0001-4001-8001-000000000003', 'EN1063_BR6', 'EN1063', 'BALLISTIC', '{"ref":"EN 1063 BR6"}'::jsonb),
  ('b2000001-0001-4001-8001-000000000004', 'VPAM_VR7', 'VPAM', 'BALLISTIC', '{"ref":"VPAM VR7"}'::jsonb);

INSERT INTO vehicle_model (id, legacy_code, class_id, name, oem_platform, drive_config, base_weight_kg, max_payload_kg, stanag_base_level, base_specs, active) VALUES
  ('b1000001-0001-4001-8001-000000000001', 'VEH-TUV-1200', 'a1000001-0001-4001-8001-000000000005', 'TUV-1200', 'Toyota LC79', '4x4', 2840, 1800, NULL,
    '{"model_code":"TUV-1200","bom_reference":"BOM-TUV-1200-v3.2","drawing_set_reference":"DWG-TUV-1200-PROD-v3.2","weight_kg":2840,"length_mm":5200,"width_mm":2100,"height_mm":1980,"lead_time_days":90,"image_url":"https://www.armoredcars.com/wp-content/uploads/2016/11/Right-Front-799x599.jpg"}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000002', 'VEH-TLC300-VR7', 'a1000001-0001-4001-8001-000000000003', 'TLC 300 VR7', 'Toyota Land Cruiser 300', '4x4', 3650, 900, NULL,
    '{"model_code":"TLC-300-VR7","bom_reference":"BOM-TLC300-VR7-demo","drawing_set_reference":"DWG-TLC300-VR7-demo","weight_kg":3650,"length_mm":4980,"width_mm":1980,"height_mm":1950,"lead_time_days":120}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000003', 'VEH-ESCALADE-PPV', 'a1000001-0001-4001-8001-000000000003', 'Escalade PPV', 'Cadillac Escalade ESV', '4x4', 3900, 600, NULL,
    '{"model_code":"ESCALADE-PPV","bom_reference":"BOM-ESCALADE-PPV-demo","drawing_set_reference":"DWG-ESCALADE-PPV-demo","weight_kg":3900,"length_mm":5380,"width_mm":2060,"height_mm":1940,"lead_time_days":110}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000004', 'VEH-CIT-350', 'a1000001-0001-4001-8001-000000000001', 'CIT-350', 'Mercedes Sprinter', '4x2', 4200, 2500, NULL,
    '{"model_code":"CIT-350","bom_reference":"BOM-CIT-350-demo","drawing_set_reference":"DWG-CIT-350-demo","weight_kg":4200,"length_mm":6100,"width_mm":2200,"height_mm":2550,"lead_time_days":100}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000005', 'VEH-APC-BATT', 'a1000001-0001-4001-8001-000000000002', 'BATT APC', 'BATT Platform', '8x8', 7800, 2000, '2',
    '{"model_code":"BATT-APC","bom_reference":"BOM-BATT-APC-demo","drawing_set_reference":"DWG-BATT-APC-demo","weight_kg":7800,"length_mm":6500,"width_mm":2450,"height_mm":2800,"lead_time_days":150}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000006', 'VEH-BATT-IFV', 'a1000001-0001-4001-8001-000000000004', 'BATT IFV', 'BATT APEX', '8x8', 8200, 1500, '3',
    '{"model_code":"BATT-IFV","bom_reference":"BOM-BATT-IFV-demo","drawing_set_reference":"DWG-BATT-IFV-demo","weight_kg":8200,"length_mm":6700,"width_mm":2500,"height_mm":2850,"lead_time_days":180}'::jsonb, true),
  ('b1000001-0001-4001-8001-000000000007', 'VEH-LD1-POLARIS', 'a1000001-0001-4001-8001-000000000005', 'LD-1 Polaris', 'Polaris MRZR', '4x4', 980, 400, NULL,
    '{"model_code":"LD-1-POLARIS","bom_reference":"BOM-LD1-POLARIS-demo","drawing_set_reference":"DWG-LD1-POLARIS-demo","weight_kg":980,"length_mm":3500,"width_mm":1700,"height_mm":1900,"lead_time_days":75}'::jsonb, true);

INSERT INTO vehicle_model_spec (model_id, param_code, value_text, value_numeric, value_unit, operator, source, confirmed) VALUES
  ('b1000001-0001-4001-8001-000000000001', 'base_price_usd', NULL, 320000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000002', 'base_price_usd', NULL, 410000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000002', 'nij_level', 'III', NULL, 'nij_level', 'EQ', 'CERTIFIED_TEST', true),
  ('b1000001-0001-4001-8001-000000000003', 'base_price_usd', NULL, 390000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000004', 'base_price_usd', NULL, 275000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000005', 'base_price_usd', NULL, 620000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000005', 'stanag_ballistic_level', NULL, 2, 'stanag_level', 'EQ', 'CERTIFIED_TEST', true),
  ('b1000001-0001-4001-8001-000000000006', 'base_price_usd', NULL, 780000, 'USD', 'EQ', 'OEM', true),
  ('b1000001-0001-4001-8001-000000000006', 'stanag_ballistic_level', NULL, 3, 'stanag_level', 'EQ', 'CERTIFIED_TEST', true),
  ('b1000001-0001-4001-8001-000000000007', 'base_price_usd', NULL, 145000, 'USD', 'EQ', 'OEM', true);

INSERT INTO organisation (id, legacy_code, name, type, country, contact_details) VALUES
  ('c1000001-0001-4001-8001-000000000001', 'CLI-UAE-MOD', 'UAE Ministry of Defence', 'CUSTOMER', 'UAE', '{"organisation":"UAE MOD"}'::jsonb),
  ('c1000001-0001-4001-8001-000000000002', 'CLI-OMAN-GOV', 'Royal Oman Police', 'CUSTOMER', 'Oman', '{"organisation":"ROP"}'::jsonb),
  ('c1000001-0001-4001-8001-000000000099', NULL, 'TAG Defence Systems', 'SUPPLIER', 'UAE', '{}'::jsonb);

INSERT INTO app_user (id, legacy_code, name, email, role, org_id) VALUES
  ('d1000001-0001-4001-8001-000000000001', 'AM-001', 'James Okonkwo', 'j.okonkwo@tag.example', 'ACCOUNT_MANAGER', 'c1000001-0001-4001-8001-000000000099');

INSERT INTO contact (id, org_id, first_name, last_name, title, role, email) VALUES
  ('e1000001-0001-4001-8001-000000000001', 'c1000001-0001-4001-8001-000000000001', 'Khalid', 'Al-Mansoori', 'Procurement Director', 'CUSTOMER_REPRESENTATIVE', 'k.almansoori@uae-mod.example'),
  ('e1000001-0001-4001-8001-000000000002', 'c1000001-0001-4001-8001-000000000002', 'Saeed', 'Al-Hinai', 'Fleet Manager', 'CUSTOMER_REPRESENTATIVE', 's.alhinai@rop.example');

INSERT INTO engagement (id, reference, customer_org_id, customer_contact_id, account_manager_id, vehicle_class_id, status, engagement_date, country_of_use, theatre, am_notes) VALUES
  ('f1000001-0001-4001-8001-000000000001', 'AVP-2026-POC', 'c1000001-0001-4001-8001-000000000001', 'e1000001-0001-4001-8001-000000000001', 'd1000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000005', 'DRAFT', '2026-01-15', 'UAE', 'Gulf', 'POC intake for TUV-1200 batch order.');

INSERT INTO requirement (engagement_id, section, parameter, value_text, priority, confirmed, source) VALUES
  ('f1000001-0001-4001-8001-000000000001', 'OPERATIONAL', 'delivery_location', 'Abu Dhabi – FOB', 'MANDATORY', true, 'CUSTOMER'),
  ('f1000001-0001-4001-8001-000000000001', 'COMMERCIAL', 'emc_compliance', 'MIL-STD-461G EMC compliance', 'MANDATORY', true, 'CUSTOMER'),
  ('f1000001-0001-4001-8001-000000000001', 'OPERATIONAL', 'exterior_finish_notes', 'RAL 7013 exterior paint on all external metalwork.', 'DESIRED', true, 'CUSTOMER');

INSERT INTO sales_order (id, legacy_code, reference, engagement_id, customer_org_id, account_manager_id, vehicle_class_id, status, total_value_usd, payment_schedule, commercial_terms, created_at) VALUES
  ('a3000001-0001-4001-8001-000000000001', 'ORD-2026-POC', 'SO-ORD-2026-POC', 'f1000001-0001-4001-8001-000000000001', 'c1000001-0001-4001-8001-000000000001', 'd1000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000005', 'DRAFT', NULL, '[]'::jsonb, '{}'::jsonb, NOW()),
  ('a3000001-0001-4001-8001-000000000002', 'ORD-2025-019', 'SO-ORD-2025-019', NULL, 'c1000001-0001-4001-8001-000000000001', 'd1000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000005', 'APPROVED', 3840000, '[]'::jsonb, '{}'::jsonb, '2025-07-22'::timestamptz),
  ('a3000001-0001-4001-8001-000000000003', 'ORD-2025-044', 'SO-ORD-2025-044', NULL, 'c1000001-0001-4001-8001-000000000001', 'd1000001-0001-4001-8001-000000000001', 'a1000001-0001-4001-8001-000000000002', 'CUSTOMER_CONFIRMED', 2480000, '[]'::jsonb, '{}'::jsonb, '2025-11-08'::timestamptz);

INSERT INTO order_batch (id, order_id, batch_number, batch_type, quantity, vehicle_model_id, configuration, status) VALUES
  ('a4000001-0001-4001-8001-000000000001', 'a3000001-0001-4001-8001-000000000001', 1, 'FIRM', 10, 'b1000001-0001-4001-8001-000000000001', '4WD + Level III', 'FIRM'),
  ('a4000001-0001-4001-8001-000000000002', 'a3000001-0001-4001-8001-000000000002', 1, 'FIRM', 12, 'b1000001-0001-4001-8001-000000000001', '4WD+Diesel+Long WB+Level III', 'FIRM'),
  ('a4000001-0001-4001-8001-000000000003', 'a3000001-0001-4001-8001-000000000003', 1, 'FIRM', 4, 'b1000001-0001-4001-8001-000000000005', 'Troop seats + blast floor', 'FIRM');

INSERT INTO line_item (order_id, batch_id, line_number, description, category, quantity, unit_price_usd, total_price_usd, status) VALUES
  ('a3000001-0001-4001-8001-000000000001', 'a4000001-0001-4001-8001-000000000001', 1, 'TUV-1200 base vehicle', 'VEHICLE', 10, 320000, 3200000, 'MANDATORY'),
  ('a3000001-0001-4001-8001-000000000001', 'a4000001-0001-4001-8001-000000000001', 2, 'Level III Protection package', 'OPTION', 10, 45000, 450000, 'OPTION'),
  ('a3000001-0001-4001-8001-000000000002', 'a4000001-0001-4001-8001-000000000002', 1, 'TUV-1200 configured unit', 'VEHICLE', 12, 320000, 3840000, 'MANDATORY'),
  ('a3000001-0001-4001-8001-000000000003', 'a4000001-0001-4001-8001-000000000003', 1, 'BATT APC configured unit', 'VEHICLE', 4, 620000, 2480000, 'MANDATORY');

INSERT INTO vehicle_option (legacy_code, vehicle_model_id, category, option_name, add_on_price_usd) VALUES
  ('opt-4wd', 'b1000001-0001-4001-8001-000000000001', 'Drive', '4WD', 0),
  ('opt-diesel', 'b1000001-0001-4001-8001-000000000001', 'Engine', 'Diesel 2.4L', 0),
  ('opt-long-wb', 'b1000001-0001-4001-8001-000000000001', 'Wheelbase', 'Long WB', 12000),
  ('opt-level3', 'b1000001-0001-4001-8001-000000000001', 'Protection', 'Level III Protection', 45000),
  ('opt-vr7', 'b1000001-0001-4001-8001-000000000002', 'Protection', 'VPAM VR7 Armoring', 85000),
  ('opt-runflat', 'b1000001-0001-4001-8001-000000000002', 'Mobility', 'Run Flat Tires', 6000),
  ('opt-luxury-cabin', 'b1000001-0001-4001-8001-000000000003', 'Interior', 'Executive Protection Interior', 25000),
  ('opt-ballistic-glass', 'b1000001-0001-4001-8001-000000000003', 'Protection', 'Certified Ballistic Glass', 30000),
  ('opt-cash-safe', 'b1000001-0001-4001-8001-000000000004', 'Cargo', 'Secure Cash Compartment', 18000),
  ('opt-cit-camera', 'b1000001-0001-4001-8001-000000000004', 'Security', 'CCTV and GPS Tracking', 12000),
  ('opt-troop-seats', 'b1000001-0001-4001-8001-000000000005', 'Interior', 'Troop Transport Seating', 40000),
  ('opt-blast-floor', 'b1000001-0001-4001-8001-000000000005', 'Protection', 'Blast Protected Floor', 95000),
  ('opt-ifv-turret', 'b1000001-0001-4001-8001-000000000006', 'Armament', 'Remote Weapon Station Provision', 120000),
  ('opt-ifv-troop', 'b1000001-0001-4001-8001-000000000006', 'Interior', 'Infantry Squad Compartment', 55000),
  ('opt-atv-armor', 'b1000001-0001-4001-8001-000000000007', 'Protection', 'Lightweight Armor Kit', 32000),
  ('opt-offroad-kit', 'b1000001-0001-4001-8001-000000000007', 'Mobility', 'Off-road Patrol Kit', 14000);

INSERT INTO document_chunks (vehicle_model_id, chunk_text, chunk_index)
SELECT vm.id, v.chunk_text, v.chunk_index
FROM (VALUES
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
  ('VEH-TLC300-VR7', 'TLC 300 VR7 package references certified ballistic glass, run flat tires, and VPAM VR7 protection.', 0)
) AS v(legacy_code, chunk_text, chunk_index)
JOIN vehicle_model vm ON vm.legacy_code = v.legacy_code;

