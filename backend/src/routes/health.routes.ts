import { Router } from "express";
import { usesPostgres } from "../config.js";
import { checkDatabase } from "../db/sql.js";
import { isLlmEnabled, getActiveModel } from "../config.js";

export default function healthRoutes(): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
    const dbOk = usesPostgres() ? await checkDatabase() : true;
    res.json({
      ok: dbOk,
      database: usesPostgres() ? (dbOk ? "connected" : "error") : "memory",
      llm: isLlmEnabled() ? "openrouter" : "stub",
      model: isLlmEnabled() ? getActiveModel() : null,
    });
  });

  return router;
}
