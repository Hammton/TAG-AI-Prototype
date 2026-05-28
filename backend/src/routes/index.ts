import { type Express } from "express";
import healthRoutes from "./health.routes.js";
import vehicleRoutes from "./vehicle.routes.js";
import orderRoutes from "./order.routes.js";
import exportRoutes from "./export.routes.js";

export function mountRoutes(app: Express): void {
  app.use(healthRoutes());
  app.use(vehicleRoutes());
  app.use(orderRoutes());
  app.use(exportRoutes());
}
