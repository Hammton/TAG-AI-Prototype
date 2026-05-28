import { Router } from "express";
import { getStore } from "../data/index.js";

export default function vehicleRoutes(): Router {
  const router = Router();

  router.get("/api/vehicles", async (req, res, next) => {
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

  router.get("/api/clients", async (_req, res, next) => {
    try {
      res.json({ clients: await getStore().listClients() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
