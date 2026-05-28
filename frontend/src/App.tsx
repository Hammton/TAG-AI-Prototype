import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArtifactDocument } from "./artifactViews";
import { friendlyAgentError, type AgentActivityEvent } from "./agentStream";
import { streamUserMessage } from "./messageStream";
import {
  artifactToHtmlBody,
  downloadDocxArtifact,
  downloadHtmlArtifact,
  downloadPdfArtifact,
  getExportPayload,
} from "./exportArtifact";
import type {
  Artifact,
  ArtifactKey,
  ArtifactRef,
  Audience,
  ChatMessage,
  PastOrderRecommendation,
  WorkflowStep,
} from "./types";

type Recommendation = {
  recommended_vehicle: {
    vehicle_model_id: string;
    model_code: string;
    type: string;
    image_url: string | null;
    reason: string;
  };
  recommended_configuration: {
    source_order_id: string | null;
    options: string[];
    configuration_option_ids: string[];
    match_reason: string;
  };
  recommendations?: PastOrderRecommendation[];
  next_actions: string[];
  has_history: boolean;
};

type PanelView = "recommendations" | "order" | ArtifactKey;

const DEFAULT_PROMPT =
  "I need an armored personnel carrier for a police tactical response unit with troop transport capacity, blast protection, and fast deployment.";

const ORDER_ID = "ORD-2026-POC";

const CLIENT_LABELS: Record<string, string> = {
  "CLI-UAE-MOD": "UAE Ministry of Defence",
  "CLI-OMAN-GOV": "Royal Oman Police",
};

const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  spec: "Specification",
  quote: "Commercial quote",
  engineering: "Engineering handover",
};

const CLIENT_PROMPTS = [{ label: "I need a vehicle", action: "recommend" as const }];

const AM_PROMPTS = [
  { label: "Recommend vehicle", action: "recommend" as const },
  { label: "Generate spec", action: "spec" as const },
  { label: "Generate quote", action: "quote" as const },
  { label: "Engineering handover", action: "engineering" as const },
];

export default function App() {
  const [audience, setAudience] = useState<Audience>("client");
  const [clientId, setClientId] = useState("CLI-UAE-MOD");
  const [qty, setQty] = useState(10);
  const [input, setInput] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [artifacts, setArtifacts] = useState<Record<ArtifactKey, Artifact | null>>({
    spec: null,
    quote: null,
    engineering: null,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState<WorkflowStep | null>(null);
  const [sending, setSending] = useState(false);
  const [panelView, setPanelView] = useState<PanelView | null>(null);
  const [orderDocument, setOrderDocument] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const workingIdRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const clientLabel = CLIENT_LABELS[clientId] ?? clientId;
  const isClient = audience === "client";
  const isAm = audience === "am";
  const hasSession = messages.length > 0;
  const splitOpen =
    panelView !== null &&
    (panelView === "recommendations"
      ? recommendation !== null
      : panelView === "order"
        ? orderDocument !== null
        : artifacts[panelView] !== null);

  const selectedOptionIds =
    recommendation?.recommended_configuration.configuration_option_ids ?? [];
  const selectedVehicleId = recommendation?.recommended_vehicle.vehicle_model_id;
  const vehicleCode = recommendation?.recommended_vehicle.model_code;

  const docMeta = useMemo(
    () => ({ orderId: ORDER_ID, clientLabel, vehicleCode }),
    [clientLabel, vehicleCode],
  );

  const configurationCards = useMemo(() => {
    if (!recommendation) return [];
    const past = recommendation.recommendations ?? [];
    if (past.length > 0) return past;
    return [
      {
        order_id:
          recommendation.recommended_configuration.source_order_id ?? "Catalogue",
        rank: 1,
        match_reason: recommendation.recommended_configuration.match_reason,
        configuration_summary:
          recommendation.recommended_configuration.options.join(", "),
        configuration_option_ids:
          recommendation.recommended_configuration.configuration_option_ids,
        unit_price_usd: null,
        date: new Date().toISOString().slice(0, 10),
      },
    ];
  }, [recommendation]);

  const currentArtifact =
    panelView && panelView !== "recommendations" && panelView !== "order" ? artifacts[panelView] : null;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function addUser(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, at: Date.now() },
    ]);
  }

  function addAssistant(
    text: string,
    artifactRefs?: ArtifactRef[],
    intelligence?: {
      conflicts?: import("./types").Conflict[];
      suggestions?: import("./types").Suggestion[];
      vehicle_preview?: import("./types").VehiclePreview;
      intelligence_briefs?: import("./types").IntelligenceBrief[];
    },
  ) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        artifacts: artifactRefs,
        conflicts: intelligence?.conflicts,
        suggestions: intelligence?.suggestions,
        vehicle_preview: intelligence?.vehicle_preview,
        intelligence_briefs: intelligence?.intelligence_briefs,
        at: Date.now(),
      },
    ]);
  }

  function appendAssistantToken(id: string, token: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "assistant" && m.id === id ? { ...m, text: m.text + token } : m,
      ),
    );
  }

  function finalizeAssistant(
    id: string,
    text: string,
    artifactRefs?: ArtifactRef[],
    intelligence?: {
      conflicts?: import("./types").Conflict[];
      suggestions?: import("./types").Suggestion[];
      vehicle_preview?: import("./types").VehiclePreview;
      intelligence_briefs?: import("./types").IntelligenceBrief[];
    },
  ) {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "assistant" && m.id === id
          ? {
              ...m,
              text,
              artifacts: artifactRefs,
              conflicts: intelligence?.conflicts,
              suggestions: intelligence?.suggestions,
              vehicle_preview: intelligence?.vehicle_preview,
              intelligence_briefs: intelligence?.intelligence_briefs,
              streaming: false,
            }
          : m,
      ),
    );
  }

  function startWorking(label: string, step: WorkflowStep) {
    const id = crypto.randomUUID();
    workingIdRef.current = id;
    flushSync(() => {
      setBusy(step);
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "working",
          label,
          step,
          events: [],
          expanded: true,
          active: true,
          at: Date.now(),
        },
      ]);
    });
  }

  function updateWorkingMeta(label: string, step: WorkflowStep) {
    const wid = workingIdRef.current;
    if (!wid) return;
    flushSync(() => {
      setBusy(step);
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "working" && m.id === wid ? { ...m, label, step } : m,
        ),
      );
    });
  }

  function pushActivity(event: AgentActivityEvent) {
    const wid = workingIdRef.current;
    if (!wid) return;
    flushSync(() => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.role !== "working" || m.id !== wid) return m;
          if (event.type === "thinking" && event.live) {
            const events = [...m.events];
            const last = events[events.length - 1];
            if (last?.type === "thinking" && last.live) {
              events[events.length - 1] = event;
              return { ...m, events };
            }
            return { ...m, events: [...events, event] };
          }
          return { ...m, events: [...m.events, event] };
        }),
      );
    });
  }

  function deactivateWorking() {
    const wid = workingIdRef.current;
    if (!wid) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "working" && m.id === wid
          ? { ...m, active: false, expanded: true }
          : m,
      ),
    );
    setBusy(null);
  }

  function toggleWorking(id: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "working" && m.id === id ? { ...m, expanded: !m.expanded } : m,
      ),
    );
  }

  function openPanel(view: PanelView) {
    setPanelView(view);
  }

  async function routeUserMessage(text: string) {
    const assistantId = crypto.randomUUID();
    let assistantStarted = false;
    let workingStarted = false;
    let activeStep: WorkflowStep = "recommend";

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      setSending(true);
      workingStarted = true;
      startWorking("Working", activeStep);

      const done = await streamUserMessage(
        {
          message: text,
          client_id: clientId,
          audience,
          history,
          has_recommendation: !!recommendation,
          has_vehicle_selected: !!selectedVehicleId,
          vehicle_code: vehicleCode,
          vehicle_model_id: selectedVehicleId,
          configuration_option_ids: selectedOptionIds,
          qty,
          order_id: ORDER_ID,
        },
        {
          onToken: (token) => {
            if (!assistantStarted) {
              assistantStarted = true;
              setMessages((prev) => [
                ...prev,
                {
                  id: assistantId,
                  role: "assistant",
                  text: token,
                  streaming: true,
                  at: Date.now(),
                },
              ]);
            } else {
              appendAssistantToken(assistantId, token);
            }
          },
          onEvent: (event) => {
            if (event.type === "route") {
              if (
                event.intent === "generate_spec" ||
                event.intent === "generate_quote" ||
                event.intent === "generate_engineering"
              ) {
                activeStep =
                  event.intent === "generate_spec"
                    ? "spec"
                    : event.intent === "generate_quote"
                      ? "quote"
                      : "engineering";
                updateWorkingMeta(
                  `Drafting ${ARTIFACT_LABELS[activeStep].toLowerCase()}`,
                  activeStep,
                );
              } else if (event.intent === "recommend") {
                activeStep = "recommend";
                updateWorkingMeta(
                  "Finding the right vehicle and configuration",
                  activeStep,
                );
              } else if (event.intent === "order") {
                activeStep = "quote";
                updateWorkingMeta("Building sales order & commercial spec", activeStep);
              } else if (
                event.intent === "chat" ||
                event.intent === "clarify" ||
                event.intent === "client_blocked"
              ) {
                updateWorkingMeta("Composing a reply", activeStep);
              }
            }
            if (
              event.type === "route" ||
              event.type === "phase" ||
              event.type === "thinking" ||
              event.type === "tool"
            ) {
              if (workingStarted) pushActivity(event);
            }
          },
          onDone: () => {
            if (workingStarted) {
              deactivateWorking();
              workingStarted = false;
            }
          },
        },
      );

      if (workingStarted) deactivateWorking();

      const artifactRefs: ArtifactRef[] = [];
      if (done.recommendation) {
        const rec = done.recommendation as Recommendation;
        setRecommendation(rec);
        setPanelView("recommendations");
        artifactRefs.push({
          id: "rec-main",
          view: "recommendations",
          title: `${rec.recommended_vehicle.model_code} — vehicle recommendation`,
          subtitle: "Document · Configuration",
        });
      }
      if (done.artifact_kind && done.artifact_result) {
        const kind = done.artifact_kind;
        setArtifacts((prev) => ({
          ...prev,
          [kind]: {
            kind,
            title: ARTIFACT_LABELS[kind],
            data: done.artifact_result,
            generatedAt: new Date().toISOString(),
          },
        }));
        setPanelView(kind);
        artifactRefs.push({
          id: `art-${kind}`,
          view: kind,
          title: `${vehicleCode ?? "Vehicle"} — ${ARTIFACT_LABELS[kind]}`,
          subtitle: `Document · ${ARTIFACT_LABELS[kind]}`,
        });
      }

      if (done.order_document) {
        setOrderDocument(done.order_document);
        setPanelView("order");
        artifactRefs.push({
          id: "order-doc",
          view: "order",
          title: `${vehicleCode ?? "Vehicle"} — Sales Order & Commercial Spec`,
          subtitle: "Document · Stage 2",
        });
      }
      const intelligence = {
        conflicts: done.conflicts,
        suggestions: done.suggestions,
        vehicle_preview: done.vehicle_preview,
        intelligence_briefs: done.intelligence_briefs,
      };
      if (!assistantStarted) {
        addAssistant(done.reply, artifactRefs.length ? artifactRefs : undefined, intelligence);
      } else {
        finalizeAssistant(
          assistantId,
          done.reply,
          artifactRefs.length ? artifactRefs : undefined,
          intelligence,
        );
      }
    } catch (err) {
      if (workingStarted) deactivateWorking();
      if (assistantStarted) {
        finalizeAssistant(assistantId, friendlyAgentError(err));
      } else {
        addAssistant(friendlyAgentError(err));
      }
    } finally {
      setSending(false);
    }
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text || busy || sending) return;
    setInput("");
    addUser(text);
    void routeUserMessage(text);
  }

  function handleQuickAction(action: "recommend" | ArtifactKey) {
    if (action === "recommend") {
      const text = input.trim() || DEFAULT_PROMPT;
      setInput("");
      addUser(text);
      void routeUserMessage(text);
      return;
    }
    if (isClient) return;
    const label = `Generate ${ARTIFACT_LABELS[action].toLowerCase()}`;
    addUser(label);
    void routeUserMessage(label);
  }

  function submitOrderRequest() {
    if (!recommendation || orderSubmitted) return;
    setOrderSubmitted(true);
    addUser("Submit order request to Account Manager");
    addAssistant(
      `Your order request for **${vehicleCode}** (qty ${qty}) has been sent to the Account Manager. They will prepare the specification, commercial quote, and engineering handover. Reference: ${ORDER_ID}.`,
    );
  }

  async function handleDownload(format: "html" | "docx" | "pdf") {
    if (!panelView) return;
    const payload = getExportPayload(
      panelView as ArtifactKey | "recommendations",
      recommendation,
      artifacts,
      docMeta,
    );
    if (!payload) return;
    try {
      if (format === "html") {
        downloadHtmlArtifact(
          payload.title,
          artifactToHtmlBody(payload.kind, payload.data, docMeta),
          payload.title.replace(/\s+/g, "-").toLowerCase(),
        );
      } else if (format === "pdf") {
        downloadPdfArtifact(
          payload.title,
          artifactToHtmlBody(payload.kind, payload.data, docMeta),
        );
      } else {
        await downloadDocxArtifact({ ...payload, meta: docMeta });
      }
    } catch {
      addAssistant("Download failed. Try again or use the HTML preview.");
    }
  }

  function useConfiguration(order: PastOrderRecommendation) {
    if (!recommendation) return;
    const options = order.configuration_summary
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setRecommendation({
      ...recommendation,
      recommended_configuration: {
        source_order_id: order.order_id,
        configuration_option_ids: order.configuration_option_ids,
        options: options.length > 0 ? options : recommendation.recommended_configuration.options,
        match_reason: order.match_reason,
      },
    });
    addAssistant(`Using configuration from ${order.order_id} as the baseline.`);
  }

  return (
    <div className={`claude-app ${hasSession ? "session-active" : ""} ${splitOpen ? "artifact-open" : ""}`}>
      <nav className="icon-rail" aria-label="Main">
        <span className="rail-logo">TAG</span>
        <div className="rail-audience" aria-label="View mode">
          <button
            type="button"
            className={isClient ? "active" : ""}
            onClick={() => setAudience("client")}
            title="Client view"
          >
            C
          </button>
          <button
            type="button"
            className={isAm ? "active" : ""}
            onClick={() => setAudience("am")}
            title="Account Manager view"
          >
            AM
          </button>
        </div>
        <button
          type="button"
          className="rail-btn"
          title="New session"
          onClick={() => {
            setMessages([]);
            setRecommendation(null);
            setArtifacts({ spec: null, quote: null, engineering: null });
            setPanelView(null);
            setInput("");
            setOrderSubmitted(false);
          }}
        >
          +
        </button>
      </nav>

      <section className="chat-column">
        {!hasSession ? (
          <HomeView
            audience={audience}
            clientLabel={clientLabel}
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onQuickAction={handleQuickAction}
            busy={!!busy || sending}
            showSettings={showSettings}
            onToggleSettings={() => setShowSettings((s) => !s)}
            clientId={clientId}
            onClientChange={setClientId}
            qty={qty}
            onQtyChange={setQty}
          />
        ) : (
          <>
            <header className="chat-topbar">
              <span className="chat-title">
                <span className={`view-badge ${audience}`}>
                  {isClient ? "Client" : "Account Manager"}
                </span>
                {vehicleCode ? `${vehicleCode} · ${clientLabel}` : "TAG Configurator"}
              </span>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowSettings((s) => !s)}
              >
                Settings
              </button>
            </header>

            {showSettings && (
              <SettingsBar
                clientId={clientId}
                onClientChange={setClientId}
                qty={qty}
                onQtyChange={setQty}
              />
            )}

            <div className="thread">
              {messages.map((msg, idx) => (
                <ThreadMessage
                  key={msg.id}
                  message={msg}
                  busy={busy}
                  onToggleWorking={() => msg.role === "working" && toggleWorking(msg.id)}
                  onOpenArtifact={(ref) => openPanel(ref.view)}
                />
              ))}
              <div ref={threadEndRef} />
            </div>

            <Composer
              audience={audience}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              busy={!!busy || sending}
              hasRecommendation={!!recommendation}
              orderSubmitted={orderSubmitted}
              onQuickAction={handleQuickAction}
              onSubmitOrder={submitOrderRequest}
            />
          </>
        )}
      </section>

      {splitOpen && panelView && (
        <ArtifactPanel
          audience={audience}
          view={panelView}
          title={
            panelView === "recommendations"
              ? `${vehicleCode ?? "Vehicle"} recommendation`
              : panelView === "order"
                ? "Sales Order & Commercial Specification"
                : currentArtifact?.title ?? ARTIFACT_LABELS[panelView as ArtifactKey]
          }
          busy={busy}
          recommendation={recommendation}
          configurationCards={configurationCards}
          orderDocument={orderDocument}
          currentArtifact={currentArtifact}
          docMeta={docMeta}
          orderSubmitted={orderSubmitted}
          selectedSourceId={recommendation?.recommended_configuration.source_order_id}
          onClose={() => setPanelView(null)}
          onUseConfiguration={useConfiguration}
          onSubmitOrder={submitOrderRequest}
          onDownload={handleDownload}
          onGenerate={(k) => {
            addUser(`Generate ${ARTIFACT_LABELS[k].toLowerCase()}`);
            void routeUserMessage(`Generate ${ARTIFACT_LABELS[k].toLowerCase()}`);
          }}
        />
      )}
    </div>
  );
}

function HomeView({
  audience,
  clientLabel,
  input,
  onInputChange,
  onSubmit,
  onQuickAction,
  busy,
  showSettings,
  onToggleSettings,
  clientId,
  onClientChange,
  qty,
  onQtyChange,
}: {
  audience: Audience;
  clientLabel: string;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onQuickAction: (a: "recommend" | ArtifactKey) => void;
  busy: boolean;
  showSettings: boolean;
  onToggleSettings: () => void;
  clientId: string;
  onClientChange: (id: string) => void;
  qty: number;
  onQtyChange: (n: number) => void;
}) {
  return (
    <div className="home-view">
      <header className="home-top">
        <span className="home-plan">TAG Vehicle Systems · PoC</span>
      </header>

      <div className="home-center">
        <h1 className="home-greeting">
          <span className="greeting-icon" aria-hidden>
            ✦
          </span>
          {audience === "client"
            ? `Find the right vehicle for ${clientLabel.split("—")[0]?.trim() || "your mission"}`
            : `Prepare the package for ${clientLabel.split("—")[0]?.trim() || "your client"}`}
        </h1>
        <p className="home-sub">
          {audience === "client"
            ? "Describe what you need, review the match, then submit an order request."
            : "Recommend, then generate spec, quote, and engineering outputs."}
        </p>

        <div className="composer-box home-composer">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={
              audience === "client"
                ? "I need a vehicle — type, mission, protection level…"
                : "Describe the client need — vehicle type, mission, protection level…"
            }
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <div className="composer-footer">
            <button type="button" className="composer-icon" onClick={onToggleSettings} title="Settings">
              +
            </button>
            <span className="composer-model">TAG Agent</span>
            <button
              type="button"
              className="composer-send"
              disabled={busy || !input.trim()}
              onClick={onSubmit}
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="home-settings">
            <SettingsBar
              clientId={clientId}
              onClientChange={onClientChange}
              qty={qty}
              onQtyChange={onQtyChange}
            />
          </div>
        )}

        <div className="home-pills">
          {(audience === "client" ? CLIENT_PROMPTS : AM_PROMPTS).map((p) => (
            <button
              key={p.action}
              type="button"
              className="home-pill"
              disabled={busy}
              onClick={() => onQuickAction(p.action)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsBar({
  clientId,
  onClientChange,
  qty,
  onQtyChange,
}: {
  clientId: string;
  onClientChange: (id: string) => void;
  qty: number;
  onQtyChange: (n: number) => void;
}) {
  return (
    <div className="settings-bar">
      <label>
        Client
        <select value={clientId} onChange={(e) => onClientChange(e.target.value)}>
          <option value="CLI-UAE-MOD">UAE Ministry of Defence</option>
          <option value="CLI-OMAN-GOV">Royal Oman Police</option>
        </select>
      </label>
      <label>
        Qty
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => onQtyChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

function Composer({
  audience,
  input,
  onInputChange,
  onSubmit,
  busy,
  hasRecommendation,
  orderSubmitted,
  onQuickAction,
  onSubmitOrder,
}: {
  audience: Audience;
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  hasRecommendation: boolean;
  orderSubmitted: boolean;
  onQuickAction: (a: "recommend" | ArtifactKey) => void;
  onSubmitOrder: () => void;
}) {
  const isClient = audience === "client";
  return (
    <footer className="composer-wrap">
      <div className="composer-box">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            hasRecommendation
              ? isClient
                ? "Add notes for your order request…"
                : "Ask for a spec, quote, or changes to the configuration…"
              : "Message TAG agent…"
          }
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="composer-footer">
          <span className="composer-model">TAG Agent</span>
          <button
            type="button"
            className="composer-send"
            disabled={busy || !input.trim()}
            onClick={onSubmit}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
      {hasRecommendation && isClient && (
        <div className="composer-pills">
          <button
            type="button"
            className="home-pill primary-pill"
            disabled={busy || orderSubmitted}
            onClick={onSubmitOrder}
          >
            {orderSubmitted ? "Order submitted" : "Submit order request"}
          </button>
        </div>
      )}
      {hasRecommendation && !isClient && (
        <div className="composer-pills">
          <button type="button" className="home-pill" disabled={busy} onClick={() => onQuickAction("spec")}>
            Spec
          </button>
          <button type="button" className="home-pill" disabled={busy} onClick={() => onQuickAction("quote")}>
            Quote
          </button>
          <button type="button" className="home-pill" disabled={busy} onClick={() => onQuickAction("engineering")}>
            Engineering
          </button>
        </div>
      )}
    </footer>
  );
}


function ThreadMessage({
  message,
  busy,
  onToggleWorking,
  onOpenArtifact,
}: {
  message: ChatMessage;
  busy: WorkflowStep | null;
  onToggleWorking: () => void;
  onOpenArtifact: (ref: ArtifactRef) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <p>{message.text}</p>
      </div>
    );
  }

  if (message.role === "working") {
    return (
      <WorkingMessage
        message={message}
        onToggleWorking={onToggleWorking}
      />
    );
  }

  const isLatest = !message.streaming && message.role === "assistant";

  return (
    <div className="msg msg-assistant">
      <div
        className="msg-prose"
        dangerouslySetInnerHTML={{
          __html: message.text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
        }}
      />
      {message.streaming && <span className="stream-cursor" aria-hidden />}
      
      {/* Intelligence Display - Conflicts */}
      {!message.streaming && message.conflicts && message.conflicts.length > 0 && (
        <div className="intelligence-panel conflicts-panel">
          <div className="panel-header">
            <span className="panel-icon">⚠️</span>
            <h4>Conflicts Detected</h4>
          </div>
          {message.conflicts.map((conflict, i) => (
            <div key={i} className={`conflict-card severity-${conflict.severity.toLowerCase()}`}>
              <div className="conflict-header">
                <span className="conflict-type">{conflict.type}</span>
                <span className="conflict-severity">{conflict.severity}</span>
              </div>
              <p className="conflict-message">{conflict.message}</p>
              <p className="conflict-explanation">{conflict.explanation}</p>
              <div className="conflict-options">
                <strong>Options:</strong>
                <ol>
                  {conflict.options.map((opt, j) => (
                    <li key={j}>{opt}</li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Intelligence Display - Suggestions */}
      {!message.streaming && message.suggestions && message.suggestions.length > 0 && (
        <div className="intelligence-panel suggestions-panel">
          <div className="panel-header">
            <span className="panel-icon">💡</span>
            <h4>Proactive Suggestions</h4>
          </div>
          {message.suggestions.map((sug, i) => (
            <div key={i} className="suggestion-card">
              <span className="suggestion-category">{sug.category.replace(/_/g, ' ')}</span>
              <p className="suggestion-message">{sug.message}</p>
              <p className="suggestion-rationale">{sug.rationale}</p>
            </div>
          ))}
        </div>
      )}

      {/* Intelligence Display - Vehicle Preview */}
      {!message.streaming && message.vehicle_preview && (
        <div className="intelligence-panel vehicle-preview-panel">
          <div className="panel-header">
            <span className="panel-icon">🎯</span>
            <h4>Vehicle Match</h4>
          </div>
          <div className="vehicle-preview-card">
            <div className="vehicle-header">
              <span className="vehicle-code">{message.vehicle_preview.model_code}</span>
              <span className="vehicle-score">
                {Math.round(message.vehicle_preview.score * 100)}% match
              </span>
            </div>
            <p className="vehicle-fit">{message.vehicle_preview.fit_summary}</p>
            {message.vehicle_preview.proactive_gaps && message.vehicle_preview.proactive_gaps.length > 0 ? (
              <div className="vehicle-gaps proactive">
                <strong>Proactive questions:</strong>
                {message.vehicle_preview.proactive_gaps.map((pg, i) => (
                  <div key={i} className={`proactive-gap priority-${pg.priority.toLowerCase()}`}>
                    <div className="proactive-gap-header">
                      <span className="proactive-gap-field">{pg.label}</span>
                      <span className={`proactive-gap-priority ${pg.priority.toLowerCase()}`}>{pg.priority}</span>
                      <span className="proactive-gap-source">{pg.source.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="proactive-gap-question">{pg.question}</p>
                    <details className="proactive-gap-rationale">
                      <summary>Why this matters</summary>
                      <p>{pg.rationale}</p>
                    </details>
                  </div>
                ))}
              </div>
            ) : message.vehicle_preview.gaps.length > 0 && (
              <div className="vehicle-gaps">
                <strong>Still needed:</strong>
                <ul>
                  {message.vehicle_preview.gaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
            {message.vehicle_preview.estimated_price_usd && (
              <p className="vehicle-price">
                Est. ${(message.vehicle_preview.estimated_price_usd / 1000000).toFixed(2)}M per unit
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Intelligence Display - Threat Intelligence Briefs */}
      {!message.streaming && message.intelligence_briefs && message.intelligence_briefs.length > 0 && (
        <div className="intelligence-panel intel-briefs-panel">
          <div className="panel-header">
            <span className="panel-icon">🌐</span>
            <h4>Threat Intelligence</h4>
          </div>
          {message.intelligence_briefs.map((brief, i) => (
            <div key={i} className="intel-brief-card">
              <div className="brief-query">{brief.query}</div>
              <p className="brief-summary">{brief.summary}</p>
              {brief.results.length > 0 && (
                <details className="brief-sources">
                  <summary>Sources ({brief.results.length})</summary>
                  <ul>
                    {brief.results.map((r, j) => (
                      <li key={j} className={`brief-source relevance-${r.relevance.toLowerCase()}`}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                        <p>{r.snippet}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {message.artifacts?.map((ref) => (
        <button
          key={ref.id}
          type="button"
          className="artifact-card"
          onClick={() => onOpenArtifact(ref)}
        >
          <span className="artifact-card-icon" aria-hidden>
            📄
          </span>
          <span className="artifact-card-text">
            <strong>{ref.title}</strong>
            <small>{ref.subtitle}</small>
          </span>
        </button>
      ))}
      <div className={`msg-actions${isLatest ? "" : " msg-actions-hidden"}`} aria-hidden>
        <button type="button" title="Copy">
          ⧉
        </button>
      </div>
    </div>
  );
}

function WorkingMessage({
  message,
  onToggleWorking,
}: {
  message: Extract<ChatMessage, { role: "working" }>;
  onToggleWorking: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!message.active) return;
    const tick = () => setElapsed(Math.floor((Date.now() - message.at) / 1000));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [message.active, message.at]);

  const active = message.active;
  const hasEvents = message.events.length > 0;
  const latest = [...message.events]
    .reverse()
    .find(
      (e) =>
        e.type === "phase" || e.type === "thinking" || e.type === "tool",
    );
  const preview = latest ? latest.message : message.label;
  const counter = active ? ` · ${elapsed}s` : "";

  return (
    <div className="msg msg-working">
      <button type="button" className="working-toggle" onClick={onToggleWorking}>
        <span className={`working-dot ${active ? "pulse" : ""}`} />
        {active ? `Working…${counter}` : `Worked${counter}`}
        <span className="working-chevron">{message.expanded ? "▾" : "▸"}</span>
      </button>
      {!message.expanded && active && preview ? (
        <p className="working-preview">{preview}</p>
      ) : null}
      {message.expanded && (
        <ul className="working-steps">
          {active && !hasEvents ? (
            <li className="thinking live">Sending request… {elapsed}s</li>
          ) : null}
          {message.events.map((e, i) => {
              if (e.type === "route") {
                return (
                  <li key={i} className="route">
                    {e.intent}
                  </li>
                );
              }
              if (e.type === "phase") {
                return (
                  <li key={i} className="phase">
                    {e.message}
                  </li>
                );
              }
              if (e.type === "thinking") {
                return (
                  <li key={i} className={e.live ? "thinking live" : "thinking"}>
                    {e.message}
                  </li>
                );
              }
              if (e.type === "tool") {
                return (
                  <li key={i} className={`tool-step ${e.state}`}>
                    <code>{e.message}</code>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        )}
      </div>
    );
}

function ArtifactPanel({
  audience,
  view,
  title,
  busy,
  recommendation,
  configurationCards,
  orderDocument,
  currentArtifact,
  docMeta,
  orderSubmitted,
  selectedSourceId,
  onClose,
  onUseConfiguration,
  onSubmitOrder,
  onDownload,
  onGenerate,
}: {
  audience: Audience;
  view: PanelView;
  title: string;
  busy: WorkflowStep | null;
  recommendation: Recommendation | null;
  configurationCards: PastOrderRecommendation[];
  orderDocument: string | null;
  currentArtifact: Artifact | null;
  docMeta: { orderId: string; clientLabel: string; vehicleCode?: string };
  orderSubmitted: boolean;
  selectedSourceId: string | null | undefined;
  onClose: () => void;
  onUseConfiguration: (o: PastOrderRecommendation) => void;
  onSubmitOrder: () => void;
  onDownload: (format: "html" | "docx" | "pdf") => void;
  onGenerate: (k: ArtifactKey) => void;
}) {
  const isClient = audience === "client";
  return (
    <aside className="artifact-panel">
      <header className="artifact-panel-header">
        <span className="artifact-panel-title">{title}</span>
        <div className="artifact-panel-actions">
          <button type="button" className="ghost-btn" onClick={() => onDownload("html")}>
            HTML
          </button>
          <button type="button" className="ghost-btn" onClick={() => onDownload("pdf")}>
            PDF
          </button>
          <button type="button" className="ghost-btn" onClick={() => onDownload("docx")}>
            Word
          </button>
          {isClient ? (
            <button
              type="button"
              className="ghost-btn accent"
              disabled={orderSubmitted}
              onClick={onSubmitOrder}
            >
              {orderSubmitted ? "Submitted" : "Submit order"}
            </button>
          ) : (
            <button type="button" className="ghost-btn accent">
              Approve
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>
      </header>
      <div className="artifact-panel-body">
        {view === "recommendations" && recommendation ? (
          <div className="artifact-recommendations">
            {recommendation.recommended_vehicle.image_url && (
              <div className="vehicle-showcase">
                <img
                  src={recommendation.recommended_vehicle.image_url}
                  alt={`${recommendation.recommended_vehicle.model_code} — ${recommendation.recommended_vehicle.type}`}
                  loading="lazy"
                  decoding="async"
                />
                <div className="vehicle-showcase-caption">
                  <strong>{recommendation.recommended_vehicle.model_code}</strong>
                  <span>{recommendation.recommended_vehicle.type}</span>
                </div>
              </div>
            )}
            <p className="artifact-lede">{recommendation.recommended_vehicle.reason}</p>
            <div className="config-cards">
              {configurationCards.map((order) => (
                <article
                  key={order.order_id}
                  className={`config-card ${selectedSourceId === order.order_id ? "selected" : ""}`}
                >
                  <h3>{order.order_id}</h3>
                  <time>{order.date}</time>
                  <p>{order.match_reason}</p>
                  <p className="config-summary">{order.configuration_summary}</p>
                  <div className="config-card-btns">
                    <button type="button" onClick={() => onUseConfiguration(order)}>
                      {isClient ? "Select configuration" : "Use configuration"}
                    </button>
                    {isClient ? (
                      <button
                        type="button"
                        className="primary"
                        disabled={orderSubmitted}
                        onClick={onSubmitOrder}
                      >
                        {orderSubmitted ? "Order submitted" : "Submit order"}
                      </button>
                    ) : (
                      <button type="button" className="primary" onClick={() => onGenerate("spec")}>
                        Generate spec
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : view === "order" && orderDocument ? (
          <article className="paper-document order-doc">
            <pre className="order-doc-md">{orderDocument}</pre>
          </article>
        ) : currentArtifact ? (
          <ArtifactDocument
            kind={currentArtifact.kind}
            data={currentArtifact.data}
            meta={docMeta}
          />
        ) : (
          <div className="artifact-loading">
            {busy ? "Generating…" : "Nothing to show"}
          </div>
        )}
      </div>
    </aside>
  );
}
