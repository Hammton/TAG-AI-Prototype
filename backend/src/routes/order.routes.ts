import { Router } from "express";
import { getStore } from "../data/index.js";

export default function orderRoutes(): Router {
  const router = Router();

  router.get("/api/orders", async (req, res, next) => {
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

  router.get("/api/orders/:id", async (req, res, next) => {
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

  return router;
}
