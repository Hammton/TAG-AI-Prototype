/**
 * Base Service Interfaces
 * 
 * Defines contracts for all services in the system.
 * Services are stateless and can be injected into workflows.
 */

// ---------------------------------------------------------------------------
// Service Registry
// ---------------------------------------------------------------------------

export interface ServiceRegistry {
  intelligence: IntelligenceService;
  document: DocumentService;
  extraction: ExtractionService;
  validation: ValidationService;
  llm: LLMService;
}

// ---------------------------------------------------------------------------
// Intelligence Service
// ---------------------------------------------------------------------------

export interface IntelligenceService {
  analyze(state: any): Promise<IntelligenceResult>;
}

export interface IntelligenceResult {
  conflicts: Conflict[];
  suggestions: Suggestion[];
  vehicleMatch: VehicleMatch | null;
}

export interface Conflict {
  type: "CONFLICT" | "WARNING" | "SUGGESTION";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  fields: string[];
  options: string[];
  explanation: string;
}

export interface Suggestion {
  category: "CUSTOMER_PATTERN" | "THREAT_IMPLICATION" | "ORDER_SIZE" | "TECH_TRANSFER";
  message: string;
  rationale: string;
}

export interface VehicleMatch {
  vehicle_model_id: string;
  model_code: string;
  type: string;
  score: number;
  fit_summary: string;
  gaps: string[];
  estimated_price_usd: number | null;
}

// ---------------------------------------------------------------------------
// Document Service
// ---------------------------------------------------------------------------

export interface DocumentService {
  generateIntake(state: any): Promise<string>;
  generateOrder(state: any): Promise<string>;
  generateSpec(state: any): Promise<string>;
}

// ---------------------------------------------------------------------------
// Extraction Service
// ---------------------------------------------------------------------------

export interface ExtractionService {
  extractCustomerDetails(text: string): Promise<Record<string, string>>;
  extractMissionRole(text: string): Promise<Record<string, string>>;
  extractProtection(text: string): Promise<Record<string, string>>;
  extractMobility(text: string): Promise<Record<string, string>>;
  extractWeapons(text: string): Promise<Record<string, string>>;
  extractC4I(text: string): Promise<Record<string, string>>;
  extractLogistics(text: string): Promise<Record<string, string>>;
  extractCommercial(text: string): Promise<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Validation Service
// ---------------------------------------------------------------------------

export interface ValidationService {
  validateCustomerDetails(data: Record<string, string>): Promise<ValidationResult>;
  validateMissionRole(data: Record<string, string>): Promise<ValidationResult>;
  validateProtection(data: Record<string, string>): Promise<ValidationResult>;
  validateMobility(data: Record<string, string>): Promise<ValidationResult>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// LLM Service
// ---------------------------------------------------------------------------

export interface LLMService {
  buildReply(params: LLMReplyParams): Promise<string>;
  extractStructuredData(text: string, schema: any): Promise<any>;
}

export interface LLMReplyParams {
  step: string;
  state: any;
  extracted?: any;
  validation?: ValidationResult;
  intelligence?: IntelligenceResult;
  userMessage: string;
}
