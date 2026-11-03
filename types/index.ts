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
  id?: string;            // Made by the server when it saved this analysis. Missing when the analysis could not be saved
  savedAt?: string;       // When the server saved it: a date and time in UTC, such as 2026-10-25T16:30:00.000Z
  documentName: string;
  executiveSummary: string;
  clauses: Clause[];
  notes?: string[];       // Things the person should know about this analysis, written by the server (for example a warning)
  isDemo?: boolean;       // true only for the built-in demo example, never for a real analysis
}

// One line of the list of saved analyses (GET /documents): the numbers a history page needs, without the clauses.
export interface DocumentSummary {
  id: string;
  documentName: string;
  savedAt: string;        // A date and time in UTC, such as 2026-10-25T16:30:00.000Z
  clauseCount: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
}

export interface DocumentList {
  documents: DocumentSummary[]; // The newest first. The server sends at most 100 lines
  total: number;                // How many saved analyses the server can read, also those that are not in the list
  unreadable: number;           // How many saved files the server could not read
}

// What happened when a saved analysis was deleted: the server deleted it, or the server said that it was already gone.
export type DeleteOutcome = "deleted" | "already-gone";