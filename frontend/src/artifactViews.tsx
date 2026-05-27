import type { ReactNode } from "react";
import type { ArtifactKey } from "./types";

type SpecData = {
  vehicle?: {
    model?: string;
    model_code?: string;
    type?: string;
    base_model_code?: string;
  };
  configuration?: Array<{
    category?: string;
    option?: string;
    name?: string;
    id?: string;
    spec_detail?: string;
  }>;
  custom_requirements?: {
    delivery?: string | null;
    compliance?: string | null;
    notes?: string | null;
  };
  technical_data?: {
    bom_reference?: string;
    drawing_set_reference?: string;
    weight_kg?: number;
    length_mm?: number;
    width_mm?: number;
    height_mm?: number;
  };
  mission_profile?: {
    primary_roles?: string[];
    protection_considerations?: string[];
    mobility_considerations?: string[];
    systems_and_payload?: string[];
  };
  integration_and_validation?: {
    integration_notes?: string[];
    validation_checklist?: string[];
  };
  build_context_references?: string[];
  source_references?: string[];
  spec_version?: string;
  generated_at?: string;
};

type QuoteData = {
  quote_reference?: string;
  lead_time_days?: number;
  payment_terms?: string;
  line_items?: Array<{
    description?: string;
    qty?: number;
    unit_price_usd?: number;
    total_usd?: number;
  }>;
  subtotal_usd?: number;
  total_usd?: number;
  notes?: string;
};

type EngineeringData = {
  engineering_package?: {
    order_id?: string;
    vehicle_model?: string;
    vehicle_type?: string;
    handover_status?: string;
    bom_reference?: string;
    drawing_set_reference?: string;
    configuration_requirements?: Array<{
      option_id?: string;
      category?: string;
      option_name?: string;
      engineering_note?: string;
    }>;
    compliance_requirements?: Array<{ source?: string; requirement?: string }>;
    custom_build_notes?: string[];
    build_context_references?: string[];
    manufacturing_work_packages?: Array<{
      package_id?: string;
      workstream?: string;
      scope?: string;
      dependencies?: string[];
    }>;
    quality_and_verification_plan?: Array<{
      check?: string;
      method?: string;
      acceptance?: string;
    }>;
    integration_interfaces?: Array<{
      system?: string;
      interface_note?: string;
      risk?: string;
    }>;
    safety_critical_notes?: string[];
    open_questions?: string[];
  };
};

export function ArtifactDocument({
  kind,
  data,
  meta,
}: {
  kind: ArtifactKey;
  data: unknown;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
}) {
  if (kind === "spec") {
    return <SpecDocument data={data as SpecData} meta={meta} />;
  }
  if (kind === "quote") {
    return <QuoteDocument data={data as QuoteData} meta={meta} />;
  }
  return <EngineeringDocument data={data as EngineeringData} meta={meta} />;
}

function DocumentShell({
  eyebrow,
  title,
  subtitle,
  metaLine,
  badge,
  banner,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  metaLine: string;
  badge: string;
  banner?: string;
  children: ReactNode;
}) {
  return (
    <article className="doc-paper">
      <header className="doc-header">
        <p className="doc-eyebrow">{eyebrow}</p>
        <h1 className="doc-title">{title}</h1>
        <p className="doc-subtitle">{subtitle}</p>
        <div className="doc-meta-row">
          <span>{metaLine}</span>
          <span className="doc-badge">{badge}</span>
        </div>
      </header>
      <div className="doc-body">{children}</div>
      {banner && <footer className="doc-banner">{banner}</footer>}
    </article>
  );
}

function SpecDocument({
  data,
  meta,
}: {
  data: SpecData;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
}) {
  const vehicle = data.vehicle ?? {};
  const config = data.configuration ?? [];
  const custom = data.custom_requirements ?? {};
  const technical = data.technical_data ?? {};
  const mission = data.mission_profile ?? {};
  const integration = data.integration_and_validation ?? {};
  const buildRefs = data.build_context_references ?? [];
  const sourceRefs = data.source_references ?? [];
  const model = vehicle.model_code ?? vehicle.model ?? meta.vehicleCode ?? "—";

  return (
    <DocumentShell
      eyebrow="Vehicle specification draft"
      title={`${model} — configured build`}
      subtitle="Prepared from catalogue data, selected options, and order requirements."
      metaLine={`${meta.clientLabel} • ${meta.orderId} • ${formatDocDate(data.generated_at)}`}
      badge={`v${data.spec_version ?? "1.0"} • DRAFT`}
    >
      <section className="doc-section">
        <h2>Vehicle</h2>
        <dl className="doc-dl">
          <div>
            <dt>Model</dt>
            <dd>{model}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{vehicle.type ?? "—"}</dd>
          </div>
          <div>
            <dt>Base platform</dt>
            <dd>{vehicle.base_model_code ?? model}</dd>
          </div>
        </dl>
      </section>

      <section className="doc-section">
        <h2>Configuration</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Option</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {config.length === 0 ? (
              <tr>
                <td colSpan={3}>No options selected</td>
              </tr>
            ) : (
              config.map((row, i) => (
                <tr key={i}>
                  <td>{row.category ?? "Configuration"}</td>
                  <td>{row.option ?? row.name ?? row.id ?? "—"}</td>
                  <td>{row.spec_detail ?? "Per catalogue specification"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="doc-section">
        <h2>Custom requirements</h2>
        <dl className="doc-dl">
          <div>
            <dt>Delivery</dt>
            <dd>{custom.delivery ?? "Per order record"}</dd>
          </div>
          <div>
            <dt>Compliance</dt>
            <dd>{custom.compliance ?? "Per order record"}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{custom.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="doc-section">
        <h2>Technical references</h2>
        <dl className="doc-dl">
          <div>
            <dt>BOM</dt>
            <dd>{technical.bom_reference ?? "—"}</dd>
          </div>
          <div>
            <dt>Drawing set</dt>
            <dd>{technical.drawing_set_reference ?? "—"}</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{technical.weight_kg != null ? `${technical.weight_kg} kg` : "—"}</dd>
          </div>
          <div>
            <dt>Dimensions (L×W×H)</dt>
            <dd>
              {technical.length_mm != null
                ? `${technical.length_mm} × ${technical.width_mm} × ${technical.height_mm} mm`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="doc-section">
        <h2>Mission profile</h2>
        <div className="doc-columns">
          <div>
            <h3>Primary roles</h3>
            <ul className="doc-list">
              {(mission.primary_roles ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Protection considerations</h3>
            <ul className="doc-list">
              {(mission.protection_considerations ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Mobility considerations</h3>
            <ul className="doc-list">
              {(mission.mobility_considerations ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Systems and payload</h3>
            <ul className="doc-list">
              {(mission.systems_and_payload ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="doc-section">
        <h2>Integration and validation</h2>
        <div className="doc-columns">
          <div>
            <h3>Integration notes</h3>
            <ul className="doc-list">
              {(integration.integration_notes ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Validation checklist</h3>
            <ul className="doc-list">
              {(integration.validation_checklist ?? []).map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {buildRefs.length > 0 && (
        <section className="doc-section">
          <h2>Build context references</h2>
          <ul className="doc-list">
            {buildRefs.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      {sourceRefs.length > 0 && (
        <section className="doc-section">
          <h2>Source references</h2>
          <ul className="doc-list">
            {sourceRefs.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}
    </DocumentShell>
  );
}

function QuoteDocument({
  data,
  meta,
}: {
  data: QuoteData;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
}) {
  const items = data.line_items ?? [];

  return (
    <DocumentShell
      eyebrow="Commercial quote draft"
      title={data.quote_reference ?? `Quote — ${meta.orderId}`}
      subtitle={`Configured vehicle package for ${meta.vehicleCode ?? "selected model"}.`}
      metaLine={`${meta.clientLabel} • ${meta.orderId} • ${formatDocDate()}`}
      badge="PRICING DRAFT"
    >
      <section className="doc-section doc-summary-grid">
        <div className="doc-stat">
          <span>Lead time</span>
          <strong>{data.lead_time_days ?? "—"} days</strong>
        </div>
        <div className="doc-stat">
          <span>Payment terms</span>
          <strong>{data.payment_terms ?? "—"}</strong>
        </div>
        <div className="doc-stat doc-stat-highlight">
          <span>Total (USD)</span>
          <strong>${formatMoney(data.total_usd)}</strong>
        </div>
      </section>

      <section className="doc-section">
        <h2>Line items</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit (USD)</th>
              <th>Total (USD)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>{item.description ?? "—"}</td>
                <td>{item.qty ?? "—"}</td>
                <td>${formatMoney(item.unit_price_usd)}</td>
                <td>${formatMoney(item.total_usd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Subtotal</td>
              <td>${formatMoney(data.subtotal_usd)}</td>
            </tr>
            <tr className="doc-total-row">
              <td colSpan={3}>Total</td>
              <td>${formatMoney(data.total_usd)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {data.notes && (
        <section className="doc-section">
          <h2>Notes</h2>
          <p className="doc-prose">{data.notes}</p>
        </section>
      )}
    </DocumentShell>
  );
}

function EngineeringDocument({
  data,
  meta,
}: {
  data: EngineeringData;
  meta: { orderId: string; clientLabel: string; vehicleCode?: string };
}) {
  const pkg = data.engineering_package ?? {};
  const requirements = pkg.configuration_requirements ?? [];
  const compliance = pkg.compliance_requirements ?? [];
  const notes = pkg.custom_build_notes ?? [];
  const context = pkg.build_context_references ?? [];
  const workPackages = pkg.manufacturing_work_packages ?? [];
  const qaPlan = pkg.quality_and_verification_plan ?? [];
  const interfaces = pkg.integration_interfaces ?? [];
  const safety = pkg.safety_critical_notes ?? [];
  const questions = pkg.open_questions ?? [];

  return (
    <DocumentShell
      eyebrow="Engineering handover"
      title={`${pkg.vehicle_model ?? meta.vehicleCode ?? "Vehicle"} build package`}
      subtitle="Internal engineering reference for manufacturing and compliance review."
      metaLine={`${meta.clientLabel} • ${pkg.order_id ?? meta.orderId}`}
      badge={pkg.handover_status ?? "DRAFT"}
      banner="INTERNAL • ENGINEERING ONLY • NOT FOR CLIENT DISTRIBUTION"
    >
      <section className="doc-section">
        <h2>Control references</h2>
        <dl className="doc-dl">
          <div>
            <dt>Vehicle type</dt>
            <dd>{pkg.vehicle_type ?? "—"}</dd>
          </div>
          <div>
            <dt>BOM</dt>
            <dd>{pkg.bom_reference ?? "—"}</dd>
          </div>
          <div>
            <dt>Drawing set</dt>
            <dd>{pkg.drawing_set_reference ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="doc-section">
        <h2>Configuration requirements</h2>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Category</th>
              <th>Engineering note</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((row, i) => (
              <tr key={i}>
                <td>{row.option_name ?? row.option_id}</td>
                <td>{row.category ?? "—"}</td>
                <td>{row.engineering_note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {compliance.length > 0 && (
        <section className="doc-section">
          <h2>Compliance</h2>
          <ul className="doc-list">
            {compliance.map((row, i) => (
              <li key={i}>
                <strong>{row.source}</strong> — {row.requirement}
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section className="doc-section">
          <h2>Custom build notes</h2>
          <ul className="doc-list">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      {context.length > 0 && (
        <section className="doc-section">
          <h2>Build context</h2>
          <ul className="doc-list">
            {context.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </section>
      )}

      {workPackages.length > 0 && (
        <section className="doc-section">
          <h2>Manufacturing work packages</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Workstream</th>
                <th>Scope</th>
                <th>Dependencies</th>
              </tr>
            </thead>
            <tbody>
              {workPackages.map((row, i) => (
                <tr key={i}>
                  <td>{row.package_id ?? "—"}</td>
                  <td>{row.workstream ?? "—"}</td>
                  <td>{row.scope ?? "—"}</td>
                  <td>{(row.dependencies ?? []).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {qaPlan.length > 0 && (
        <section className="doc-section">
          <h2>Quality and verification plan</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Method</th>
                <th>Acceptance</th>
              </tr>
            </thead>
            <tbody>
              {qaPlan.map((row, i) => (
                <tr key={i}>
                  <td>{row.check ?? "—"}</td>
                  <td>{row.method ?? "—"}</td>
                  <td>{row.acceptance ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {interfaces.length > 0 && (
        <section className="doc-section">
          <h2>Integration interfaces</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th>System</th>
                <th>Interface note</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((row, i) => (
                <tr key={i}>
                  <td>{row.system ?? "—"}</td>
                  <td>{row.interface_note ?? "—"}</td>
                  <td>{row.risk ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {safety.length > 0 && (
        <section className="doc-section">
          <h2>Safety critical notes</h2>
          <ul className="doc-list">
            {safety.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="doc-section">
        <h2>Open questions</h2>
        <ul className="doc-list">
          {questions.length === 0 ? (
            <li>None recorded</li>
          ) : (
            questions.map((q, i) => <li key={i}>{q}</li>)
          )}
        </ul>
      </section>
    </DocumentShell>
  );
}

function formatDocDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: unknown) {
  if (typeof value !== "number") return "0";
  return value.toLocaleString();
}
