/**
 * Document Service
 * 
 * Generates formatted documents from captured data.
 * Delegates to specific generators for each document type.
 */

import type { DocumentService as IDocumentService } from "../base/service.interface.js";
import { IntakeDocGenerator } from "./generators/intake-doc.generator.js";

export class DocumentService implements IDocumentService {
  private intakeGenerator: IntakeDocGenerator;

  constructor() {
    this.intakeGenerator = new IntakeDocGenerator();
  }

  async generateIntake(state: any): Promise<string> {
    return this.intakeGenerator.generate(state);
  }

  async generateOrder(state: any): Promise<string> {
    // TODO: Implement order document generation
    return "Order document generation not yet implemented";
  }

  async generateSpec(state: any): Promise<string> {
    // TODO: Implement spec document generation
    return "Spec document generation not yet implemented";
  }
}
