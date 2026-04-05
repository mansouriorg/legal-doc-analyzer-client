// types/index.ts

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface Clause {
  id: string;
  title: string;          // e.g., "Dispute Resolution", "Jurisdiction", "Force Majeure"
  originalText: string;   // The exact text from the document
  riskLevel: RiskLevel;   // Flagged risk severity
  explanation: string;    // The AI's plain-language summary of what this means
}

export interface DocumentAnalysis {
  documentName: string;
  executiveSummary: string;
  clauses: Clause[];
}