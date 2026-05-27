import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

type ExportPayload = {
  kind: "recommendations" | "spec" | "quote" | "engineering";
  title: string;
  data: unknown;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
};

type Block = Paragraph | Table;

const PAGE = {
  size: { width: 12240, height: 15840 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
};

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

export async function buildDocxBuffer(payload: ExportPayload): Promise<Buffer> {
  const children = buildContent(payload);
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 24 },
        },
      },
    },
    sections: [
      {
        properties: { page: PAGE },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun(payload.title)],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `TAG Vehicle Systems · ${payload.meta.clientLabel} · ${payload.meta.orderId}`,
                size: 20,
                color: "666666",
              }),
            ],
            spacing: { after: 240 },
          }),
          ...children,
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function buildContent(payload: ExportPayload): Block[] {
  const { kind, data, meta } = payload;

  if (kind === "recommendations") {
    const rec = data as {
      recommended_vehicle?: { model_code?: string; type?: string; reason?: string };
      recommended_configuration?: { options?: string[] };
    };
    const v = rec.recommended_vehicle ?? {};
    const opts = rec.recommended_configuration?.options ?? [];
    return [
      p(`Vehicle: ${v.model_code ?? meta.vehicleCode} (${v.type ?? ""})`),
      p(v.reason ?? ""),
      p("Recommended options:", true),
      ...opts.map((o) => p(`• ${o}`)),
    ];
  }

  if (kind === "spec") {
    const spec = data as Record<string, unknown>;
    const vehicle = (spec.vehicle ?? {}) as Record<string, string>;
    const rows = ((spec.configuration ?? []) as Array<Record<string, string>>).map(
      (r) =>
        new TableRow({
          children: [
            cell(r.category ?? "Configuration"),
            cell(r.option ?? r.name ?? ""),
          ],
        }),
    );
    const mission = (spec.mission_profile ?? {}) as Record<string, string[]>;
    const integ = (spec.integration_and_validation ?? {}) as Record<string, string[]>;
    const refs = (spec.source_references ?? []) as string[];
    return [
      p(`Model: ${vehicle.model_code ?? vehicle.model ?? meta.vehicleCode}`),
      p(`Type: ${vehicle.type ?? ""}`),
      makeTable(["Category", "Option"], rows),
      p("Mission profile", true),
      ...list("Primary roles", mission.primary_roles ?? []),
      ...list(
        "Protection considerations",
        mission.protection_considerations ?? [],
      ),
      ...list("Mobility considerations", mission.mobility_considerations ?? []),
      ...list("Systems and payload", mission.systems_and_payload ?? []),
      p("Integration and validation", true),
      ...list("Integration notes", integ.integration_notes ?? []),
      ...list("Validation checklist", integ.validation_checklist ?? []),
      ...list("Source references", refs),
    ];
  }

  if (kind === "quote") {
    const quote = data as Record<string, unknown>;
    const items = (quote.line_items ?? []) as Array<Record<string, unknown>>;
    const rows = items.map(
      (item) =>
        new TableRow({
          children: [
            cell(String(item.description ?? "")),
            cell(String(item.qty ?? "")),
            cell(String(item.total_usd ?? "")),
          ],
        }),
    );
    return [
      p(`Quote reference: ${quote.quote_reference ?? ""}`),
      p(`Lead time: ${quote.lead_time_days ?? ""} days`),
      makeTable(["Description", "Qty", "Total USD"], rows),
      p(`Total: USD ${quote.total_usd ?? ""}`, true),
    ];
  }

  const pkg = ((data as Record<string, unknown>).engineering_package ?? {}) as Record<
    string,
    unknown
  >;
  const work = (pkg.manufacturing_work_packages ?? []) as Array<Record<string, unknown>>;
  const qa = (pkg.quality_and_verification_plan ?? []) as Array<Record<string, unknown>>;
  const interfaces = (pkg.integration_interfaces ?? []) as Array<Record<string, unknown>>;
  const safety = (pkg.safety_critical_notes ?? []) as string[];
  return [
    p(`Order: ${pkg.order_id ?? meta.orderId}`),
    p(`Vehicle: ${pkg.vehicle_model ?? meta.vehicleCode}`),
    p(`Status: ${pkg.handover_status ?? "DRAFT"}`),
    p("Manufacturing work packages", true),
    makeTable(
      ["ID", "Workstream", "Scope"],
      work.map(
        (r) =>
          new TableRow({
            children: [
              cell(String(r.package_id ?? "")),
              cell(String(r.workstream ?? "")),
              cell(String(r.scope ?? "")),
            ],
          }),
      ),
    ),
    p("Quality and verification", true),
    makeTable(
      ["Check", "Method", "Acceptance"],
      qa.map(
        (r) =>
          new TableRow({
            children: [
              cell(String(r.check ?? "")),
              cell(String(r.method ?? "")),
              cell(String(r.acceptance ?? "")),
            ],
          }),
      ),
    ),
    p("Integration interfaces", true),
    makeTable(
      ["System", "Interface note", "Risk"],
      interfaces.map(
        (r) =>
          new TableRow({
            children: [
              cell(String(r.system ?? "")),
              cell(String(r.interface_note ?? "")),
              cell(String(r.risk ?? "")),
            ],
          }),
      ),
    ),
    ...list("Safety critical notes", safety),
    p("INTERNAL — Engineering handover only. Not for client distribution.", true),
  ];
}

function p(text: string, bold = false) {
  return new Paragraph({
    children: [new TextRun({ text, bold })],
    spacing: { after: 120 },
  });
}

function cell(text: string) {
  return new TableCell({
    width: { size: 4680, type: WidthType.DXA },
    borders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun(text)] })],
  });
}

function headerCell(text: string) {
  return new TableCell({
    width: { size: 4680, type: WidthType.DXA },
    borders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: { fill: "F0F0F0", type: ShadingType.CLEAR },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20 })],
      }),
    ],
  });
}

function makeTable(headers: string[], rows: TableRow[]) {
  const colW = Math.floor(9360 / headers.length);
  const headerRow = new TableRow({
    children: headers.map((h) => headerCell(h)),
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: headers.map(() => colW),
    rows: [headerRow, ...rows],
  });
}

function list(title: string, values: string[]): Paragraph[] {
  if (values.length === 0) return [];
  return [p(`${title}:`, true), ...values.map((v) => p(`• ${v}`))];
}
