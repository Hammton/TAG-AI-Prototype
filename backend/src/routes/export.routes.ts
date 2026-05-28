import { Router } from "express";
import { buildDocxBuffer } from "../lib/build-docx.js";

export default function exportRoutes(): Router {
  const router = Router();

  router.post("/api/export/docx", async (req, res, next) => {
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

  return router;
}
