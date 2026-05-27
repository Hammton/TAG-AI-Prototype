import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("API", () => {
  it("GET /health — memory store", async () => {
    const res = await request(app).get("/health");
    expect(res.body.database).toBe("memory");
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/intent classifies greeting as chat", async () => {
    const res = await request(app)
      .post("/api/intent")
      .send({
        message: "Hi there",
        client_id: "CLI-UAE-MOD",
        audience: "am",
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("chat");
    expect(res.body.reply).toBeTruthy();
  });

  it("POST /api/intent classifies mission text as recommend", async () => {
    const res = await request(app)
      .post("/api/intent")
      .send({
        message:
          "Client needs an armored personnel carrier for police tactical response with troop transport.",
        client_id: "CLI-UAE-MOD",
        audience: "am",
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("recommend");
    expect(res.body.agent_text).toBeTruthy();
  });

  it("POST /api/intent uses thread context for follow-up recommend", async () => {
    const res = await request(app)
      .post("/api/intent")
      .send({
        message: "Yes — Level III protection and desert 4WD please",
        client_id: "CLI-UAE-MOD",
        audience: "am",
        history: [
          {
            role: "user",
            content:
              "We need tactical utility vehicles for Abu Dhabi desert operations.",
          },
          {
            role: "assistant",
            content: "I can recommend a platform for that mission.",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("recommend");
    expect(res.body.agent_text?.toLowerCase()).toContain("desert");
  });

  it("POST /api/chat greets without recommending a vehicle", async () => {
    const res = await request(app)
      .post("/api/chat")
      .send({
        message: "Hi",
        client_id: "CLI-UAE-MOD",
        audience: "am",
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBeTruthy();
    expect(res.body.reply.toLowerCase()).not.toContain("matched this to");
    expect(res.body.reply.toLowerCase()).not.toContain("batt-apc");
  });

  it("POST /api/agent recommend rejects vague intent", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "recommend",
        client_id: "CLI-UAE-MOD",
        user_text: "hi",
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("insufficient_intent");
  });

  it("POST /api/agent recommend", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "recommend",
        client_id: "CLI-UAE-MOD",
        vehicle_model_id: "VEH-TUV-1200",
      });

    expect(res.status).toBe(200);
    expect(res.body.result.has_history).toBe(true);
  });

  it("POST /api/agent recommend from client requirement text", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "recommend",
        client_id: "CLI-UAE-MOD",
        user_text:
          "We need 10 tactical utility vehicles for Abu Dhabi desert operations with Level III protection and military compliance.",
      });

    expect(res.status).toBe(200);
    expect(res.body.result.recommended_vehicle.vehicle_model_id).toBe(
      "VEH-TUV-1200",
    );
    expect(res.body.result.recommended_vehicle.model_code).toBe("TUV-1200");
    expect(res.body.result.recommended_vehicle.image_url).toContain(
      "Right-Front-799x599.jpg",
    );
    expect(res.body.result.recommended_configuration.options).toContain(
      "Level III Protection",
    );
    expect(res.body.result.next_actions).toContain("generate_spec");
  });

  it("POST /api/agent recommend picks BATT-IFV for infantry fighting vehicle intent", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "recommend",
        client_id: "CLI-UAE-MOD",
        user_text: "show me this BATT-IFV for infantry fighting",
      });

    expect(res.status).toBe(200);
    expect(res.body.result.recommended_vehicle.vehicle_model_id).toBe(
      "VEH-BATT-IFV",
    );
    expect(res.body.result.recommended_vehicle.model_code).toBe("BATT-IFV");
    expect(res.body.result.recommended_vehicle.type).toContain(
      "Infantry Fighting Vehicle",
    );
  });

  it("POST /api/agent recommend picks vehicle family from client intent", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "recommend",
        client_id: "CLI-UAE-MOD",
        user_text:
          "We need an armored personnel carrier for a police tactical response unit with troop transport capacity.",
      });

    expect(res.status).toBe(200);
    expect(res.body.result.recommended_vehicle.vehicle_model_id).toBe(
      "VEH-APC-BATT",
    );
    expect(res.body.result.recommended_vehicle.image_url).toContain(
      "batt-apex-1.webp",
    );
    expect(res.body.result.recommended_vehicle.type).toContain(
      "Armored Personnel Carrier",
    );
  });

  it("POST /api/agent quote", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "generate_quote",
        vehicle_model_id: "VEH-TUV-1200",
        configuration_option_ids: [
          "opt-4wd",
          "opt-diesel",
          "opt-long-wb",
          "opt-level3",
        ],
        qty: 10,
      });

    expect(res.body.result.total_usd).toBe(3770000);
  });

  it("POST /api/agent engineering output", async () => {
    const res = await request(app)
      .post("/api/agent")
      .send({
        mode: "generate_engineering_output",
        order_id: "ORD-2026-POC",
        vehicle_model_id: "VEH-TUV-1200",
        configuration_option_ids: ["opt-4wd", "opt-level3"],
        qty: 10,
      });

    expect(res.status).toBe(200);
    expect(res.body.result.engineering_package.order_id).toBe("ORD-2026-POC");
    expect(res.body.result.engineering_package.vehicle_model).toBe("TUV-1200");
    expect(res.body.result.engineering_package.bom_reference).toBe(
      "BOM-TUV-1200-v3.2",
    );
    expect(res.body.result.engineering_package.drawing_set_reference).toBe(
      "DWG-TUV-1200-PROD-v3.2",
    );
    expect(
      res.body.result.engineering_package.configuration_requirements,
    ).toContainEqual(
      expect.objectContaining({
        option_id: "opt-level3",
        option_name: "Level III Protection",
      }),
    );
    expect(res.body.result.engineering_package.handover_status).toBe(
      "ready_for_engineering",
    );
  });
});
