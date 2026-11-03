// services/api.ts
import type { DeleteOutcome, DocumentAnalysis, DocumentList, DocumentSummary } from "@/types"; // Using the types we created earlier

// The address of the NestJS server when no other address is set.
export const DEFAULT_API_URL = "http://localhost:3001"; // Your NestJS server port

const WRITE_LIKE = "Write it like http://localhost:3001, starting with http:// or https://.";

// A value of the setting that cannot be used. The message names the setting, so that the person knows where to look.
// It does not repeat the value, which could have a password in it.
function badSetting(reason: string): Error {
  return new Error(`The server address in NEXT_PUBLIC_API_URL is not valid. ${reason} Change the setting, then start the page again.`);
}

// Turns the value of the setting NEXT_PUBLIC_API_URL into the address that every call uses (see "Changing the server address" in the README).
// A missing or empty value gives DEFAULT_API_URL. A value that cannot be used throws an Error whose message can be shown to the person.
// It is not replaced by the default without a word, because then a typo would go unnoticed.
// The result has no slash at the end, so a path can be added after it. A path in the value, for example https://example.com/api, is kept.
export function resolveApiBaseUrl(setting: string | undefined): string {
  const text = (setting ?? "").trim();
  if (text === "") {
    return DEFAULT_API_URL;
  }

  // Chromium and Node 22 do not agree about a space inside an address (Chromium changes it, Node refuses it), so it is refused here.
  if (/\s/.test(text)) {
    throw badSetting("It must not contain spaces or line breaks.");
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw badSetting(WRITE_LIKE);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw badSetting(WRITE_LIKE);
  }

  if (url.username !== "" || url.password !== "") {
    throw badSetting("It must not contain a user name or a password.");
  }

  if (text.includes("?") || text.includes("#")) {
    throw badSetting("It must not contain a ? or a #.");
  }

  let path = url.pathname;
  while (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return url.origin + path;
}

// Reads the setting. Next.js replaces the exact text process.env.NEXT_PUBLIC_API_URL below by the value of the setting
// when it builds the page, in the code for the browser and in the code for the server. A copy of process.env, or process.env[name],
// would not be replaced, so the setting must be read in exactly this way.
// When the page is built without the setting, the text can stay as it is, and a browser can have no process object. Reading it would then
// throw an error and stop every call, so an error here means that there is no setting, and the default address is used.
function readSetting(): string | undefined {
  try {
    return process.env.NEXT_PUBLIC_API_URL;
  } catch {
    return undefined;
  }
}

// The address that the calls use. It is read at the moment of the call and not once when this file is loaded, so the tests can change it.
function getApiBaseUrl(): string {
  return resolveApiBaseUrl(readSetting());
}

// Checks the minimum the results page needs. A wrong answer from the server then
// gives a clear error message instead of crashing the page.
function looksLikeAnalysis(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.documentName === "string" &&
    typeof record.executiveSummary === "string" &&
    Array.isArray(record.clauses)
  );
}

// For these answers the server writes a message for the person who uploaded the file:
// 400 (the file was not accepted), 415 (an old .doc file), 422 (a password, a damaged file or no text),
// 502 (the AI service gave an error), 503 (the AI service cannot be used now) and 504 (it was too slow).
// 500 is left out on purpose: the server only says "Internal server error" there.
const SERVER_MESSAGE_STATUSES = [400, 415, 422, 502, 503, 504];
const MAX_SERVER_MESSAGE_LENGTH = 300;

// Reads the "message" of an error answer of the NestJS server.
// Returns null when there is no usable message (not JSON, no text, only spaces).
async function readServerMessage(response: Response): Promise<string | null> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const raw = (data as Record<string, unknown>).message;
  const text = Array.isArray(raw)
    ? raw.filter((part): part is string => typeof part === "string").join(" ")
    : raw;

  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }

  const message = text.trim();
  return message.length > MAX_SERVER_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_SERVER_MESSAGE_LENGTH)}...`
    : message;
}

const MAX_NOTES = 10;
const MAX_NOTE_LENGTH = 500;

// Makes the notes of an analysis safe to show: only texts, without empty ones and repeats,
// and not too many or too long. Anything else (for example a missing list) gives an empty list.
export function cleanNotes(value: unknown): string[] {
  if (Array.isArray(value) === false) {
    return [];
  }

  const notes: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item === "string" && item.trim() !== "" && notes.length < MAX_NOTES) {
      const text = item.trim();
      const shown = text.length > MAX_NOTE_LENGTH ? `${text.slice(0, MAX_NOTE_LENGTH)}...` : text;
      if (notes.includes(shown) === false) {
        notes.push(shown);
      }
    }
  }

  return notes;
}

// Shown first when the person asked not to keep an analysis, but the server saved it anyway. A server that is older than
// the form field "save" does not know it, so it saves every analysis.
export const SAVED_ANYWAY_NOTE =
  "You asked not to keep this analysis, but the server saved it anyway. It may be an older version that does not know this choice. You can delete the saved analysis in the History list.";

// The id of the saved copy when the person asked not to keep the analysis and the server saved it anyway. Null in every other case.
// The server sends an id only for an analysis it saved.
export function savedAgainstChoice(analysis: DocumentAnalysis, askedNotToKeep: boolean): string | null {
  if (askedNotToKeep === false) {
    return null;
  }

  return typeof analysis.id === "string" && analysis.id !== "" ? analysis.id : null;
}

// The same analysis as it is once the saved copy is deleted: no id, no time of saving, and not the note that says it was saved.
// The other notes of the server stay. The summary and the clauses are not changed, and the analysis it was given is not changed.
export function withoutSavedCopy(analysis: DocumentAnalysis): DocumentAnalysis {
  const copy: DocumentAnalysis = {
    ...analysis,
    notes: cleanNotes(analysis.notes).filter((note) => note !== SAVED_ANYWAY_NOTE),
  };
  delete copy.id;
  delete copy.savedAt;
  return copy;
}

export interface AnalyzeOptions {
  // false asks the server not to save this analysis: the form field "save" is sent with the value "false".
  // Anything else sends nothing, so the server decides, and by default it saves.
  keep?: boolean;
  // With a signal, the caller can stop the request (AbortController.abort). The browser then drops the request and the answer.
  // Once the signal is aborted, the only error analyzeDocument throws is ANALYSIS_STOPPED_MESSAGE, never "could not reach the server" or another reason.
  signal?: AbortSignal;
}

// The message of the error that analyzeDocument throws when its request was stopped with the signal.
export const ANALYSIS_STOPPED_MESSAGE = "The analysis was stopped before the server answered.";

// Sends the document to the server and returns the analysis.
// When anything goes wrong it throws an Error whose message can be shown to the user.
// It never returns invented data.
// Stopping drops the request. A server whose README has the section "Stopping an analysis" then drops its own call to the AI service too, and saves nothing,
// unless the AI service had already answered. An older server keeps working on the analysis until the AI service answers or gives up, and saves it.
export async function analyzeDocument(file: File, options: AnalyzeOptions = {}): Promise<DocumentAnalysis> {
  try {
    return await sendDocument(file, options);
  } catch (error) {
    if (options.signal?.aborted === true) {
      throw new Error(ANALYSIS_STOPPED_MESSAGE);
    }
    throw error;
  }
}

async function sendDocument(file: File, options: AnalyzeOptions): Promise<DocumentAnalysis> {
  const formData = new FormData();
  formData.append("document", file);
  if (options.keep === false) {
    formData.append("save", "false");
  }

  const baseUrl = getApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/analyze`, {
      method: "POST",
      body: formData,
      signal: options.signal,
    });
  } catch {
    throw new Error(
      `Could not reach the server at ${baseUrl}. Check that the backend is running, then try again.`,
    );
  }

  if (response.ok === false) {
    // 413 can also come from a proxy in front of the server, so this text does not depend on the answer.
    if (response.status === 413) {
      throw new Error("The file is too large for the server. Please choose a smaller file.");
    }

    if (SERVER_MESSAGE_STATUSES.includes(response.status)) {
      const message = await readServerMessage(response);
      if (message !== null) {
        throw new Error(message);
      }
    }

    throw new Error(`The server could not analyze this document (status ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server answered, but its answer is not valid data.");
  }

  if (looksLikeAnalysis(data) === false) {
    throw new Error("The server answered, but its answer is missing the summary or the clauses.");
  }

  const analysis = data as DocumentAnalysis;

  // The server sends an id only for an analysis it saved. If the person asked not to keep this one and the answer has an id,
  // the server saved it anyway. The person is told, and the note comes first so that it is never cut off.
  if (savedAgainstChoice(analysis, options.keep === false) !== null) {
    return { ...analysis, notes: [SAVED_ANYWAY_NOTE, ...cleanNotes(analysis.notes)] };
  }

  return analysis;
}

// A made-up example result, so the screens can be looked at without a backend.
// It is only shown when the user asks for it, and it is always marked with isDemo.
export function getDemoAnalysis(): DocumentAnalysis {
  return {
    isDemo: true,
    documentName: "Demo example (not your document)",
    executiveSummary: "This document is a standard Non-Disclosure Agreement (NDA). It heavily favors the disclosing party and restricts the receiving party from engaging in competitive business for a period of 2 years.",
    clauses: [
      {
        id: "1",
        title: "Confidentiality Obligations",
        originalText: "The Receiving Party agrees to maintain strictly confidential all Information and not to disclose it to any third party without prior written consent.",
        riskLevel: "Low",
        explanation: "Standard confidentiality requirement. Ensure your team has secure data handling practices in place."
      },
      {
        id: "2",
        title: "Non-Compete Clause",
        originalText: "The Receiving Party shall not directly or indirectly engage in any business that competes with the Disclosing Party for a period of 24 months globally.",
        riskLevel: "High",
        explanation: "Highly restrictive. This prevents you from working in the same industry globally for 2 years after signing."
      },
      {
        id: "3",
        title: "Governing Law",
        originalText: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.",
        riskLevel: "Medium",
        explanation: "Standard, but requires you to understand or hire counsel familiar with Delaware law in case of a dispute."
      }
    ]
  };
}

export interface ChatTurn {
  role: "user" | "ai";
  content: string;
}

// Reads a count from the server: a whole number that is not negative. Returns null for anything else.
function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

// Reads one line of the list of saved analyses.
// Returns null when the line is not usable, so that one wrong line does not hide the others.
function readSummary(value: unknown): DocumentSummary | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const clauseCount = readCount(row.clauseCount);
  const highRisks = readCount(row.highRisks);
  const mediumRisks = readCount(row.mediumRisks);
  const lowRisks = readCount(row.lowRisks);

  if (
    typeof row.id !== "string" ||
    row.id === "" ||
    typeof row.documentName !== "string" ||
    typeof row.savedAt !== "string" ||
    clauseCount === null ||
    highRisks === null ||
    mediumRisks === null ||
    lowRisks === null
  ) {
    return null;
  }

  return {
    id: row.id,
    documentName: row.documentName,
    savedAt: row.savedAt,
    clauseCount,
    highRisks,
    mediumRisks,
    lowRisks,
  };
}

// Reads the answer of GET /documents. Returns null when it does not have the expected form.
// Lines that are not usable, and lines with an id that was already seen, are left out.
function readDocumentList(value: unknown): DocumentList | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const total = readCount(record.total);
  const unreadable = readCount(record.unreadable);

  if (Array.isArray(record.documents) === false || total === null || unreadable === null) {
    return null;
  }

  const documents: DocumentSummary[] = [];
  for (const item of record.documents as unknown[]) {
    const summary = readSummary(item);
    if (summary !== null && documents.some((known) => known.id === summary.id) === false) {
      documents.push(summary);
    }
  }

  return { documents, total, unreadable };
}

// Loads the list of saved analyses for the history page: the newest first, without the clauses.
// When anything goes wrong it throws an Error whose message can be shown to the user.
// It never returns invented data.
export async function listDocuments(): Promise<DocumentList> {
  const baseUrl = getApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/documents`, { cache: "no-store" });
  } catch {
    throw new Error(`Could not reach the server at ${baseUrl}. Check that the backend is running.`);
  }

  if (response.ok === false) {
    throw new Error(`The server could not list the saved analyses (status ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server answered, but its answer is not valid data.");
  }

  const list = readDocumentList(data);
  if (list === null) {
    throw new Error("The server answered, but its list of saved analyses is not valid.");
  }

  return list;
}

// Loads one saved analysis. Returns null when the server says the document does not exist (404).
export async function getDocumentById(id: string): Promise<DocumentAnalysis | null> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (response.ok === false) {
    throw new Error(`Server responded with status ${response.status}`);
  }

  return (await response.json()) as DocumentAnalysis;
}

// The text that the server sends with its 404 when no analysis has the id. With this text a 404 means
// "this analysis is already gone". A 404 with another text, for example from an older server that has no
// delete route, is not treated like that, because then the analysis may still be saved.
const NOT_SAVED_MESSAGE = "There is no saved analysis with this id.";

// The text that the server sends with its 500 when a delete failed. It is written for the person and has
// no private details, so it is shown. A 500 with any other text is not shown, only its status.
const DELETE_FAILED_MESSAGE = "The saved analysis could not be deleted. The reason is in the log of the server.";

// Deletes one saved analysis for good (DELETE /documents/:id).
// Returns "deleted" when the server answers 204, and "already-gone" when the server says that no analysis has this id.
// For everything else it throws an Error whose message can be shown to the user.
// It never says "deleted" without the 204 of the server.
export async function deleteDocument(id: string): Promise<DeleteOutcome> {
  // encodeURIComponent leaves "." and ".." as they are, and a browser would turn them into a different path.
  if (id.trim() === "" || id === "." || id === "..") {
    throw new Error("This analysis has no usable id, so it cannot be deleted.");
  }

  const baseUrl = getApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch {
    throw new Error(`Could not reach the server at ${baseUrl}. Check that the backend is running, then try again.`);
  }

  if (response.status === 204) {
    return "deleted";
  }

  if (response.status === 404) {
    if ((await readServerMessage(response)) === NOT_SAVED_MESSAGE) {
      return "already-gone";
    }
    throw new Error(
      "The server does not know this request (status 404). It may be an older version that cannot delete analyses yet. Restart it with the latest code.",
    );
  }

  if (response.status === 500) {
    const message = await readServerMessage(response);
    if (message === DELETE_FAILED_MESSAGE) {
      throw new Error(message);
    }
  }

  throw new Error(`The server could not delete this analysis (status ${response.status}).`);
}

// The text that the server sends with its 500 when a saved file cannot be read. It is written for the person and
// has no private details, so it is shown. A 500 with any other text is not shown, only its status.
const NOT_READABLE_MESSAGE = "The saved file of this analysis cannot be read. It may have been changed or damaged.";

// For these answers the server writes a message that is fit to show to the person who asked:
// 400 (the question or the earlier messages are not right) and 502, 503 and 504 (the AI service gave an error,
// cannot be used now, or was too slow). The messages of 502, 503 and 504 can name the host of the AI service.
const ASK_MESSAGE_STATUSES = [400, 502, 503, 504];

// The message of the error that askDocumentQuestion throws when its request was stopped with the signal.
export const ASK_STOPPED_MESSAGE = "The question was stopped before the server answered.";

// Sends one question about a saved document, plus the earlier turns, and returns the answer (POST /documents/:id/ask).
// When anything goes wrong it throws an Error whose message can be shown to the user.
// It never returns invented text: an answer without text is an error.
// With a signal, the caller can stop the request (AbortController.abort). The browser then drops the request and the answer.
// Once the signal is aborted, the only error this function throws is ASK_STOPPED_MESSAGE, never "could not reach the server" or another reason.
// Stopping drops the request. A server that has src/client-gone.ts then drops its own call to the AI service too. Whether the model itself stops generating is up to the AI service.
// An older server keeps working on the question until the AI service answers or gives up.
export async function askDocumentQuestion(
  documentId: string,
  question: string,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<{ answer: string }> {
  try {
    return await sendQuestion(documentId, question, history, signal);
  } catch (error) {
    if (signal?.aborted === true) {
      throw new Error(ASK_STOPPED_MESSAGE);
    }
    throw error;
  }
}

async function sendQuestion(
  documentId: string,
  question: string,
  history: ChatTurn[],
  signal: AbortSignal | undefined,
): Promise<{ answer: string }> {
  // encodeURIComponent leaves "." and ".." as they are, and a browser would turn them into a different path.
  if (documentId.trim() === "" || documentId === "." || documentId === "..") {
    throw new Error("This analysis has no usable id, so no question can be asked about it.");
  }

  const baseUrl = getApiBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/documents/${encodeURIComponent(documentId)}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({
        question,
        history: history.map((turn) => ({ role: turn.role, content: turn.content })),
      }),
    });
  } catch {
    throw new Error(`Could not reach the server at ${baseUrl}. Check that the backend is running, then try again.`);
  }

  if (response.ok === false) {
    // 413 can also come from a proxy in front of the server, so this text does not depend on the answer.
    if (response.status === 413) {
      throw new Error("The conversation is too big for the server. Reload the page to start a new one.");
    }

    if (ASK_MESSAGE_STATUSES.includes(response.status)) {
      const message = await readServerMessage(response);
      if (message !== null) {
        throw new Error(message);
      }
    }

    if (response.status === 404) {
      if ((await readServerMessage(response)) === NOT_SAVED_MESSAGE) {
        throw new Error("This analysis is no longer saved on the server, so no question can be asked about it.");
      }
      throw new Error(
        "The server does not know this request (status 404). It may be an older version that cannot answer questions yet. Restart it with the latest code.",
      );
    }

    if (response.status === 500 && (await readServerMessage(response)) === NOT_READABLE_MESSAGE) {
      throw new Error(NOT_READABLE_MESSAGE);
    }

    throw new Error(`The server could not answer this question (status ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server answered, but its answer is not valid data.");
  }

  const answer = typeof data === "object" && data !== null ? (data as Record<string, unknown>).answer : undefined;
  if (typeof answer !== "string" || answer.trim() === "") {
    throw new Error("The server answered, but its answer has no text.");
  }

  return { answer: answer.trim() };
}
