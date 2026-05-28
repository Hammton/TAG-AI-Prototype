import { getVehicleModel } from "../vehicle/vehicle.service.js";
import { getStore } from "../../data/index.js";

export async function calculateQuoteLineItems(input: {
  vehicle_model_id: string;
  configuration_option_ids: string[];
  qty: number;
}) {
  const vehicle = await getVehicleModel(input.vehicle_model_id);
  if (!vehicle) {
    throw new Error(`Unknown vehicle model: ${input.vehicle_model_id}`);
  }

  const prices = await getStore().getOptionPrices(input.configuration_option_ids);
  let optionsSubtotal = 0;
  for (const id of input.configuration_option_ids) {
    const price = prices.get(id);
    if (price === undefined) throw new Error(`Unknown option: ${id}`);
    optionsSubtotal += price;
  }

  const unit_price = vehicle.base_price_usd + optionsSubtotal;
  const subtotal = unit_price * input.qty;

  return {
    base_price: vehicle.base_price_usd,
    options_subtotal: optionsSubtotal,
    unit_price,
    qty: input.qty,
    subtotal,
    total_usd: subtotal,
    lead_time_days: vehicle.lead_time_days,
  };
}
