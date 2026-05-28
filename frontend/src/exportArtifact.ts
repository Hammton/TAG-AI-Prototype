import { API } from "./api";
import type { Artifact, ArtifactKey } from "./types";

/** Printable HTML artifact (web-artifacts-builder style: single self-contained file). */
export function downloadHtmlArtifact(
  title: string,
  bodyHtml: string,
  filename: string,
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #141414; line-height: 1.55; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .meta { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-family: Inter, sans-serif; font-size: 14px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: #666; }
    .tag { color: #e8621a; font-weight: 700; }
  </style>
</head>
<body>
  <p class="meta">TAG Vehicle Systems</p>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
}

/** Print-to-PDF export from rendered HTML body. */
export function downloadPdfArtifact(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #141414; line-height: 1.55; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .meta { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-family: Inter, sans-serif; font-size: 13px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 10px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: #666; }
    .tag { color: #e8621a; font-weight: 700; }
  </style>
</head>
<body>
  <p class="meta">TAG Vehicle Systems</p>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (!popup) {
    throw new Error("Popup blocked — allow popups to export PDF.");
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

export async function downloadDocxArtifact(payload: {
  kind: ArtifactKey | "recommendations";
  title: string;
  data: unknown;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
}) {
  const res = await fetch(`${API}/api/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("DOCX export failed");
  }
  const blob = await res.blob();
  const name =
    res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
    `${payload.title.replace(/\s+/g, "-").toLowerCase()}.docx`;
  downloadBlob(blob, name);
}

export function artifactToHtmlBody(
  kind: ArtifactKey | "recommendations",
  data: unknown,
  meta: { orderId: string; clientLabel: string; vehicleCode?: string },
): string {
  if (kind === "recommendations") {
    const rec = data as {
      recommended_vehicle?: { model_code?: string; type?: string; reason?: string };
      recommended_configuration?: { options?: string[] };
    };
    const v = rec.recommended_vehicle ?? {};
    const opts = rec.recommended_configuration?.options ?? [];
    return `
      <p><strong>Client:</strong> ${escapeHtml(meta.clientLabel)}</p>
      <p><strong>Vehicle:</strong> ${escapeHtml(v.model_code ?? "")} — ${escapeHtml(v.type ?? "")}</p>
      <p>${escapeHtml(v.reason ?? "")}</p>
      <h2>Recommended options</h2>
      <ul>${opts.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>
    `;
  }

  if (kind === "spec") {
    const spec = data as Record<string, unknown>;
    const vehicle = (spec.vehicle ?? {}) as Record<string, string>;
    const config = (spec.configuration ?? []) as Array<Record<string, string>>;
    const mission = (spec.mission_profile ?? {}) as Record<string, string[]>;
    const integ = (spec.integration_and_validation ?? {}) as Record<string, string[]>;
    const buildRefs = (spec.build_context_references ?? []) as string[];
    const srcRefs = (spec.source_references ?? []) as string[];
    return `
      <p><strong>Order:</strong> ${escapeHtml(meta.orderId)} · ${escapeHtml(meta.clientLabel)}</p>
      <h2>Vehicle</h2>
      <p>${escapeHtml(vehicle.model_code ?? vehicle.model ?? meta.vehicleCode ?? "")} — ${escapeHtml(vehicle.type ?? "")}</p>
      <h2>Configuration</h2>
      <table><thead><tr><th>Category</th><th>Option</th></tr></thead><tbody>
      ${config.map((r) => `<tr><td>${escapeHtml(r.category ?? "")}</td><td>${escapeHtml(r.option ?? r.name ?? "")}</td></tr>`).join("")}
      </tbody></table>
      <h2>Mission profile</h2>
      <h3>Primary roles</h3><ul>${(mission.primary_roles ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h3>Protection considerations</h3><ul>${(mission.protection_considerations ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h3>Mobility considerations</h3><ul>${(mission.mobility_considerations ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h3>Systems and payload</h3><ul>${(mission.systems_and_payload ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h2>Integration and validation</h2>
      <h3>Integration notes</h3><ul>${(integ.integration_notes ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h3>Validation checklist</h3><ul>${(integ.validation_checklist ?? []).map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h2>Build context references</h2><ul>${buildRefs.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
      <h2>Source references</h2><ul>${srcRefs.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>
    `;
  }

  if (kind === "quote") {
    const quote = data as Record<string, unknown>;
    const items = (quote.line_items ?? []) as Array<Record<string, unknown>>;
    return `
      <p><strong>Reference:</strong> ${escapeHtml(String(quote.quote_reference ?? ""))}</p>
      <table><thead><tr><th>Description</th><th>Qty</th><th>Total USD</th></tr></thead><tbody>
      ${items.map((i) => `<tr><td>${escapeHtml(String(i.description ?? ""))}</td><td>${i.qty ?? ""}</td><td>${i.total_usd ?? ""}</td></tr>`).join("")}
      </tbody></table>
      <p><strong>Total:</strong> <span class="tag">USD ${quote.total_usd ?? ""}</span></p>
    `;
  }

  const pkg = ((data as Record<string, unknown>).engineering_package ?? {}) as Record<
    string,
    unknown
  >;
  const work = (pkg.manufacturing_work_packages ?? []) as Array<Record<string, unknown>>;
  const qa = (pkg.quality_and_verification_plan ?? []) as Array<Record<string, unknown>>;
  const ints = (pkg.integration_interfaces ?? []) as Array<Record<string, unknown>>;
  const safety = (pkg.safety_critical_notes ?? []) as string[];
  return `
    <p><strong>Order:</strong> ${escapeHtml(String(pkg.order_id ?? meta.orderId))}</p>
    <p><strong>Vehicle:</strong> ${escapeHtml(String(pkg.vehicle_model ?? meta.vehicleCode ?? ""))}</p>
    <p><strong>Status:</strong> ${escapeHtml(String(pkg.handover_status ?? "DRAFT"))}</p>
    <h2>Manufacturing work packages</h2>
    <table><thead><tr><th>ID</th><th>Workstream</th><th>Scope</th><th>Dependencies</th></tr></thead><tbody>
    ${work.map((r) => `<tr><td>${escapeHtml(String(r.package_id ?? ""))}</td><td>${escapeHtml(String(r.workstream ?? ""))}</td><td>${escapeHtml(String(r.scope ?? ""))}</td><td>${escapeHtml(Array.isArray(r.dependencies) ? r.dependencies.join(", ") : "")}</td></tr>`).join("")}
    </tbody></table>
    <h2>Quality and verification plan</h2>
    <table><thead><tr><th>Check</th><th>Method</th><th>Acceptance</th></tr></thead><tbody>
    ${qa.map((r) => `<tr><td>${escapeHtml(String(r.check ?? ""))}</td><td>${escapeHtml(String(r.method ?? ""))}</td><td>${escapeHtml(String(r.acceptance ?? ""))}</td></tr>`).join("")}
    </tbody></table>
    <h2>Integration interfaces</h2>
    <table><thead><tr><th>System</th><th>Interface note</th><th>Risk</th></tr></thead><tbody>
    ${ints.map((r) => `<tr><td>${escapeHtml(String(r.system ?? ""))}</td><td>${escapeHtml(String(r.interface_note ?? ""))}</td><td>${escapeHtml(String(r.risk ?? ""))}</td></tr>`).join("")}
    </tbody></table>
    <h2>Safety critical notes</h2><ul>${safety.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
    <p><em>Internal engineering handover — not for client distribution.</em></p>
  `;
}

export function getExportPayload(
  view: ArtifactKey | "recommendations",
  recommendation: unknown,
  artifacts: Record<ArtifactKey, Artifact | null>,
  meta: { orderId: string; clientLabel: string; vehicleCode?: string },
): { kind: ArtifactKey | "recommendations"; title: string; data: unknown } | null {
  if (view === "recommendations" && recommendation) {
    return {
      kind: "recommendations",
      title: `${meta.vehicleCode ?? "Vehicle"} recommendation`,
      data: recommendation,
    };
  }
  const art = artifacts[view as ArtifactKey];
  if (art) {
    return { kind: art.kind, title: art.title, data: art.data };
  }
  return null;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
