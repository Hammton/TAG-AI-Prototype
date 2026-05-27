import cors from "cors";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import type { AgentActivityEvent } from "./agent/activity.js";
import { runChat } from "./agent/chat.js";
import { classifyIntent } from "./agent/intent.js";
import { runAgent } from "./agent/index.js";
import { streamUserMessage } from "./agent/orchestrate.js";
import { buildDocxBuffer } from "./lib/build-docx.js";
import { getEnv, getActiveModel, isLlmEnabled, usesPostgres } from "./config.js";
import { checkDatabase } from "./db/sql.js";
import { getStore } from "./data/index.js";
import { agentRequestSchema } from "./schemas/agent.js";
import { chatRequestSchema } from "./schemas/chat.js";
import { intentRequestSchema } from "./schemas/intent.js";
import { messageRequestSchema } from "./schemas/message.js";
import { prepareSseResponse, writeSse, writeSseKeepalive } from "./lib/sse.js";

export function createApp() {
  const app = express();
  const env = getEnv();

  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.static(join(__dirname, "..", "public")));

  app.get("/health", async (_req, res) => {
    const dbOk = usesPostgres() ? await checkDatabase() : true;
    res.json({
      ok: dbOk,
      database: usesPostgres() ? (dbOk ? "connected" : "error") : "memory",
      llm: isLlmEnabled() ? "openrouter" : "stub",
      model: isLlmEnabled() ? getActiveModel() : null,
    });
  });

  app.get("/api/vehicles", async (req, res, next) => {
    try {
      const store = getStore();
      const vehicles = await store.listVehicles();
      const vehicleModelId = req.query.vehicle_model_id as string | undefined;
      const options = vehicleModelId
        ? await store.listOptions(vehicleModelId)
        : [];
      res.json({ vehicles, options });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/clients", async (_req, res, next) => {
    try {
      res.json({ clients: await getStore().listClients() });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/orders", async (req, res, next) => {
    try {
      const orders = await getStore().listOrders({
        client_id: req.query.client_id as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/orders/:id", async (req, res, next) => {
    try {
      const order = await getStore().getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/intent", async (req, res, next) => {
    try {
      const body = intentRequestSchema.parse(req.body);
      const result = await classifyIntent(body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/chat", async (req, res, next) => {
    try {
      const body = chatRequestSchema.parse(req.body);
      const { reply, engine } = await runChat(body);
      res.json({ reply, engine });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/agent", async (req, res, next) => {
    try {
      const body = agentRequestSchema.parse(req.body);
      const { result, engine, record_id } = await runAgent(body);
      res.json({ mode: body.mode, result, engine, record_id });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/export/docx", async (req, res, next) => {
    try {
      const body = req.body as {
        kind: "recommendations" | "spec" | "quote" | "engineering";
        title: string;
        data: unknown;
        meta: { orderId: string; clientLabel: string; vehicleCode?: string };
      };
      if (!body?.kind || !body?.title || !body?.data || !body?.meta) {
        res.status(400).json({ error: "invalid_export_payload" });
        return;
      }
      const buffer = await buildDocxBuffer(body);
      const safeName = body.title.replace(/[^\w.-]+/g, "-").slice(0, 80);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}.docx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/message/stream", async (req, res, next) => {
    try {
      const body = messageRequestSchema.parse(req.body);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();
      prepareSseResponse(res);

      const write = (event: AgentActivityEvent) => writeSse(res, event);
      write({ type: "thinking", message: "Connected", live: true });

      const keepalive = setInterval(() => writeSseKeepalive(res), 8_000);

      try {
        await streamUserMessage(body, write);
        res.end();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        write({ type: "error", message });
        res.end();
      } finally {
        clearInterval(keepalive);
      }
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/agent/stream", async (req, res, next) => {
    try {
      const body = agentRequestSchema.parse(req.body);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const write = (event: AgentActivityEvent) => writeSse(res, event);

      try {
        const { result, engine, record_id } = await runAgent(body, write);
        write({
          type: "result",
          mode: body.mode,
          result,
          engine,
          record_id,
        });
        res.end();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        write({ type: "error", message });
        res.end();
      }
    } catch (err) {
      next(err);
    }
  });

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err && typeof err === "object" && "issues" in err) {
        res.status(400).json({ error: "validation_error" });
        return;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = message === "agent_loop_limit" ? 504 : 500;
      res.status(status).json({ error: message });
    },
  );

  return app;
}
