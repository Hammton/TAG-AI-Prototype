export interface DataStore {
  listClients(): Promise<
    Array<{ id: string; name: string; country: string | null }>
  >;
  listVehicles(): Promise<
    Array<{
      id: string;
      model_code: string;
      type: string;
      base_price_usd: number;
      lead_time_days: number;
      image_url: string | null;
    }>
  >;
  listOptions(vehicle_model_id: string): Promise<
    Array<{
      id: string;
      name: string;
      category: string;
      add_on_price_usd: number;
    }>
  >;
  searchPastOrders(
    client_id: string,
    vehicle_model_id: string,
    limit?: number,
  ): Promise<
    Array<{
      order_id: string;
      date: string;
      qty: number;
      status: string;
      configuration_summary: string;
      configuration_option_ids: string[];
      unit_price_usd: number | null;
      similarity_score: number;
    }>
  >;
  getVehicleModel(vehicle_model_id: string): Promise<{
    id: string;
    model_code: string;
    type: string;
    base_price_usd: number;
    lead_time_days: number;
    image_url: string | null;
  } | null>;
  getConfigurationOptions(vehicle_model_id: string): Promise<{
    categories: Record<
      string,
      Array<{ id: string; name: string; add_on_price: number }>
    >;
  }>;
  getCustomRequirements(order_id: string): Promise<{
    delivery: string | null;
    compliance: string | null;
    notes: string | null;
  }>;
  searchBuildContext(
    query: string,
    vehicle_model_id: string,
    limit?: number,
  ): Promise<Array<{ text: string }>>;
  getCadMetadata(vehicle_model_id: string): Promise<Record<string, unknown> | null>;
  getOptionPrices(option_ids: string[]): Promise<Map<string, number>>;
  saveSpec(order_id: string, spec_json: unknown): Promise<string>;
  saveQuote(
    order_id: string,
    quote_json: unknown,
    unit_price_usd: number | null,
    total_usd: number | null,
  ): Promise<string>;
  listOrders(filters?: {
    client_id?: string;
    status?: string;
  }): Promise<unknown[]>;
  getOrder(order_id: string): Promise<unknown | null>;
}
