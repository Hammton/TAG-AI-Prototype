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

  listVehicleClasses(): Promise<Array<{ id: string; code: string; label: string }>>;
  listEngagements(filters?: { client_id?: string; status?: string }): Promise<unknown[]>;
  getEngagement(reference: string): Promise<unknown | null>;
  createEngagement(input: {
    reference: string;
    customer_org_code: string;
    customer_contact_email?: string | null;
    account_manager_code?: string | null;
    vehicle_class_code: string;
    status?: string;
    country_of_use?: string | null;
    theatre?: string | null;
    am_notes?: string | null;
  }): Promise<{ id: string; reference: string }>;
  createOrUpdateEngagementRequirements(input: {
    engagement_ref: string;
    requirements: Array<{
      section: string;
      parameter: string;
      value_text: string;
      priority?: "MANDATORY" | "DESIRED" | "OPTIONAL";
      source?: "CUSTOMER" | "AM_ASSUMED" | "ENGINEERING_DEFAULT";
      confirmed?: boolean;
    }>;
  }): Promise<number>;
  runRequirementMatch(input: {
    engagement_ref: string;
    vehicle_model_id?: string;
  }): Promise<{
    recommendation_id: string;
    candidates: Array<{
      vehicle_model_id: string;
      model_code: string;
      type: string;
      rank: number;
      match_score: number;
      match_tier: "EXACT" | "CLOSE" | "POSSIBLE" | "REQUIRES_CUSTOMISATION";
      matched_mandatory: number;
      total_mandatory: number;
      matched_desired: number;
      total_desired: number;
      gaps: Array<{ parameter: string; required: string; actual: string; severity: string }>;
      summary: string;
    }>;
  }>;
  createSalesOrderFromEngagement(input: {
    engagement_ref: string;
    sales_order_ref: string;
    vehicle_model_id: string;
    quantity: number;
  }): Promise<{ sales_order_ref: string }>;
  buildStage3SpecSections(input: {
    sales_order_ref: string;
    spec_document_number: string;
    generated_by?: string;
  }): Promise<{ specification_id: string; sections_created: number }>;
  persistSpecTraceability(input: {
    spec_document_number: string;
  }): Promise<{ linked_requirements: number }>;
}
