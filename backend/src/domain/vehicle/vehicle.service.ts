import { getStore } from "../../data/index.js";

export async function searchPastOrders(
  client_id: string,
  vehicle_model_id: string,
  limit = 3,
) {
  return getStore().searchPastOrders(client_id, vehicle_model_id, limit);
}

export async function getVehicleModel(vehicle_model_id: string) {
  return getStore().getVehicleModel(vehicle_model_id);
}

export async function listVehicleModels() {
  return getStore().listVehicles();
}

export async function getConfigurationOptions(vehicle_model_id: string) {
  return getStore().getConfigurationOptions(vehicle_model_id);
}
