import cors from "cors";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { getEnv } from "./config.js";
import { mountRoutes } from "./routes/index.js";

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

  mountRoutes(app);

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
      res.status(500).json({ error: message });
    },
  );

  return app;
}
