// services/history.ts
// Small helpers for the history page. They are plain functions, so they can be tested without a browser.
import type { DocumentList, DocumentSummary, RiskLevel } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A date and time with a time zone, such as 2026-10-25T16:30:00.000Z or 2026-10-25T18:30:00+02:00.
// Other forms are refused on purpose: a browser would read some of them in the local time zone,
// and then the server and the browser could show different text for the same time.
const TIME_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

// Reads a time that the server sent. Returns null when the value is not a usable time.
function readTime(value: unknown): Date | null {
  if (typeof value !== "string" || TIME_WITH_ZONE.test(value) === false) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Turns a time such as 2026-10-25T16:30:00.000Z into "25 Oct 2026, 16:30 UTC".
// The text is always in UTC, so it is the same on the server and in the browser, in every time zone.
// Returns null when the value is not a usable time.
export function formatSavedAt(value: unknown): string | null {
  const date = readTime(value);
  if (date === null) {
    return null;
  }

  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const time = `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;
  return `${day} ${month} ${year}, ${time} UTC`;
}

// The difference to UTC, such as "UTC+1", "UTC-4" or "UTC+5:30". It is "UTC" when there is no difference.
function zoneLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return "UTC";
  }

  const sign = offsetMinutes > 0 ? "+" : "-";
  const total = Math.abs(offsetMinutes);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${twoDigits(minutes)}`;
}

// Turns a time such as 2026-10-25T16:30:00.000Z into the time on the clock of the computer that runs this,
// for example "25 Oct 2026, 17:30 UTC+1". The difference to UTC is the one at that moment, so it is right in summer and in winter.
// The text depends on the time zone of the computer, so a page uses it in the browser only (see components/document/LocalTime.tsx).
// Returns null when the value is not a usable time.
export function formatLocalTime(value: unknown): string | null {
  const date = readTime(value);
  if (date === null) {
    return null;
  }

  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
  return `${day} ${month} ${year}, ${time} ${zoneLabel(Math.round(-date.getTimezoneOffset()))}`;
}

// The address of the page that shows one saved analysis.
export function reportPath(id: string): string {
  return `/documents/${encodeURIComponent(id)}`;
}

export interface RiskBadge {
  level: RiskLevel;
  text: string;
}

// The labels for the risk profile of one row: only the levels that have at least one clause.
// An analysis without clauses gives an empty list.
export function riskBadges(doc: DocumentSummary): RiskBadge[] {
  const badges: RiskBadge[] = [];
  if (doc.highRisks > 0) {
    badges.push({ level: "High", text: `${doc.highRisks} High` });
  }
  if (doc.mediumRisks > 0) {
    badges.push({ level: "Medium", text: `${doc.mediumRisks} Med` });
  }
  if (doc.lowRisks > 0) {
    badges.push({ level: "Low", text: `${doc.lowRisks} Low` });
  }
  return badges;
}

export interface HistoryStats {
  listed: number; // rows in the list
  total: number; // saved analyses the server can read, also those that are not in the list
  hidden: number; // saved analyses that are not in the list
  unreadable: number; // saved files the server could not read
  highRisks: number; // high-risk clauses in the listed analyses only
  withHighRisk: number; // listed analyses with at least one high-risk clause
}

// The numbers at the top of the history page. They are worked out from the rows,
// so they always agree with the table. The risk numbers count only the rows in the list.
export function summarizeHistory(list: DocumentList): HistoryStats {
  const listed = list.documents.length;
  const total = Math.max(list.total, listed);

  return {
    listed,
    total,
    hidden: total - listed,
    unreadable: list.unreadable,
    highRisks: list.documents.reduce((sum, doc) => sum + doc.highRisks, 0),
    withHighRisk: list.documents.filter((doc) => doc.highRisks > 0).length,
  };
}

// ---- Search and filter in the History list ----

// The address of the History page. The search form opens this address with the choices as a query, such as /dashboard?q=lease&risk=high.
export const HISTORY_PATH = "/dashboard";
export const SEARCH_PARAM = "q";
export const RISK_PARAM = "risk";
// The longest search text. A longer text in the address is cut.
export const MAX_SEARCH_LENGTH = 100;

export type RiskFilter = "high" | "medium" | "low" | "none";

// The choices of the risk list after the first one, "All analyses", which has no value.
export const RISK_CHOICES: readonly { value: RiskFilter; label: string }[] = [
  { value: "high", label: "With High risk clauses" },
  { value: "medium", label: "With Medium risk clauses" },
  { value: "low", label: "With Low risk clauses" },
  { value: "none", label: "Without clauses" },
];

export interface HistoryFilter {
  query: string; // words that a file name must contain, or "" for no search
  risk: RiskFilter | null; // null for all analyses
}

// The first text of a part of the address. Next.js gives a list when the part is repeated.
function firstText(value: unknown): string {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : "";
}

// Reads the choices of the search form from the address (the object that Next.js gives as searchParams).
// Anything that is not understood is left out, so a changed address can never break the page.
export function readHistoryFilter(params: unknown): HistoryFilter {
  if (typeof params !== "object" || params === null) {
    return { query: "", risk: null };
  }

  const values = params as Record<string, unknown>;
  const query = firstText(values[SEARCH_PARAM]).replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH).trim();
  const riskText = firstText(values[RISK_PARAM]);
  const risk = RISK_CHOICES.find((choice) => choice.value === riskText)?.value ?? null;
  return { query, risk };
}

// True when a search text or a risk choice is active.
export function isFiltering(filter: HistoryFilter): boolean {
  return filter.query !== "" || filter.risk !== null;
}

// The text in the form that is used to compare: no capital letters, and no accents
// (the small marks that are added to letters, such as the one on the e in the French word for summer).
function comparable(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f]/g, "");
}

function hasRisk(doc: DocumentSummary, risk: RiskFilter): boolean {
  switch (risk) {
    case "high":
      return doc.highRisks > 0;
    case "medium":
      return doc.mediumRisks > 0;
    case "low":
      return doc.lowRisks > 0;
    case "none":
      return doc.highRisks + doc.mediumRisks + doc.lowRisks === 0;
  }
}

// The rows that fit the search, in the same order. A file name fits when it contains every word of the search (in any order),
// and the row fits the risk choice when it has at least one clause of that level ("none": no clause at all).
export function filterHistory(rows: DocumentSummary[], filter: HistoryFilter): DocumentSummary[] {
  const words = comparable(filter.query)
    .split(/\s+/)
    .filter((word) => word !== "");

  return rows.filter((doc) => {
    const name = comparable(doc.documentName);
    return words.every((word) => name.includes(word)) && (filter.risk === null || hasRisk(doc, filter.risk));
  });
}

function analysesWord(count: number): string {
  return count === 1 ? "analysis" : "analyses";
}

// "Showing 2 of 12 analyses in the list."
export function describeFilterResult(shown: number, listed: number): string {
  return `Showing ${shown} of ${listed} ${analysesWord(listed)} in the list.`;
}

// Tells the person what the search covers when some saved analyses are not in the list. Returns null when all are in the list.
export function searchScopeNote(listed: number, hidden: number): string | null {
  if (hidden <= 0) {
    return null;
  }

  return `The search covers only the ${listed} ${analysesWord(listed)} in the list, not the ${hidden} that ${hidden === 1 ? "is" : "are"} not shown.`;
}
