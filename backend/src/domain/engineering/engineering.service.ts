import { getVehicleModel, getConfigurationOptions } from "../vehicle/vehicle.service.js";
import { getCustomRequirements, getCadMetadata, searchBuildContext } from "../engagement/engagement.service.js";
import { buildVehicleCapabilityContext } from "../capability/capability.service.js";

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
