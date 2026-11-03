// services/exportReport.ts
// Plain functions that turn an analysis into the text of a file, and into the name of that file.
// They change nothing and do not read the clock, so they can be tested without a browser.
// The buttons that use them are in components/document/ReportActions.tsx.
import type { Clause, DocumentAnalysis } from "@/types";

export const REPORT_TITLE = "Legal Document Analysis";

// The last sentence of every file and of every printed page. A file leaves the page and the warnings of the page, so it carries its own.
export const REPORT_DISCLAIMER = "This is a first reading by an AI model. It can miss a clause or get one wrong, and it is not legal advice.";

// Said at the top of a file that was made from the built-in example.
export const REPORT_DEMO_NOTE = "DEMO EXAMPLE. The clauses below are made up. They are not an analysis of a real document.";

// Every file name ends with this text before the extension, so a file can never be taken for the document itself.
export const REPORT_SUFFIX = "-analysis";
export const REPORT_EXTENSION = ".txt";

// How many characters of the name of the document are used in the name of the file.
export const MAX_NAME_LENGTH = 80;

// What the text needs besides the analysis itself.
export interface ReportDetails {
  notes: string[]; // the notes of the analysis, already cleaned (see cleanNotes in services/api.ts)
  savedAt: string | null; // when the analysis was saved, as text that the person can read, or null to leave the line out
}

// The text of a value that should be text, with line breaks as \n and without spaces around it. Anything that is not text gives "".
function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

// The same on one line.
function oneLine(value: unknown): string {
  return plain(value).replace(/\s+/g, " ");
}

// A title with a line of dashes under it, and an empty line after the lines of the section.
function section(title: string, lines: string[]): string[] {
  return [title, "-".repeat(title.length), ...lines, ""];
}

const LEVELS = ["High", "Medium", "Low"] as const;

// "3 clauses: 1 High, 1 Medium, 1 Low"
function describeClauses(clauses: Clause[]): string {
  const start = `${clauses.length} ${clauses.length === 1 ? "clause" : "clauses"}`;
  const parts: string[] = [];
  for (const level of LEVELS) {
    const count = clauses.filter((clause) => clause.riskLevel === level).length;
    if (count > 0) {
      parts.push(`${count} ${level}`);
    }
  }

  return parts.length === 0 ? start : `${start}: ${parts.join(", ")}`;
}

function clauseLines(clause: Clause, index: number): string[] {
  const title = oneLine(clause.title) || "(no title)";
  const risk = oneLine(clause.riskLevel).toUpperCase() || "UNKNOWN";
  const original = plain(clause.originalText);

  return [
    `${index + 1}. ${title} [${risk} RISK]`,
    "Original text:",
    original === "" ? "(none)" : `"${original}"`,
    "",
    "AI implication:",
    plain(clause.explanation) || "(none)",
  ];
}

// The text of the file that the person downloads. It ends with a line break, and every line break is \n.
export function buildReportText(data: DocumentAnalysis, details: ReportDetails): string {
  const lines: string[] = [REPORT_TITLE.toUpperCase(), "=".repeat(REPORT_TITLE.length), ""];

  lines.push(`Document: ${oneLine(data.documentName) || "(no name)"}`);
  if (details.savedAt !== null && details.savedAt.trim() !== "") {
    lines.push(`Saved: ${details.savedAt.trim()}`);
  }
  const id = oneLine(data.id);
  if (id !== "") {
    lines.push(`Document ID: ${id}`);
  }
  lines.push("");

  if (data.isDemo === true) {
    lines.push(REPORT_DEMO_NOTE, "");
  }

  if (details.notes.length > 0) {
    lines.push(...section(details.notes.length === 1 ? "NOTE ABOUT THIS ANALYSIS" : "NOTES ABOUT THIS ANALYSIS", details.notes.map((note) => `- ${oneLine(note)}`)));
  }

  lines.push(...section("EXECUTIVE SUMMARY", [plain(data.executiveSummary) || "(none)"]));

  const clauses = Array.isArray(data.clauses) ? data.clauses : [];
  const clauseBlocks: string[] = [];
  clauses.forEach((clause, index) => {
    if (index > 0) {
      clauseBlocks.push("");
    }
    clauseBlocks.push(...clauseLines(clause, index));
  });
  lines.push(...section("CLAUSES AND RISKS", clauses.length === 0 ? ["No clauses were found."] : [describeClauses(clauses), "", ...clauseBlocks]));

  lines.push("-".repeat(40), REPORT_DISCLAIMER);
  return lines.join("\n") + "\n";
}

// True for a character that must not be in a file name: the characters that Windows and macOS refuse (/ \ : * ? " < > |),
// control characters, and the marks that change the direction of the text or are invisible (they can make a name look like another one).
// (Spaces of every kind, and the byte order mark, are already one plain space when this is asked.)
function isUnsafe(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    code < 32 ||
    code === 127 ||
    '/\\:*?"<>|'.includes(character) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

// The name of the file without the extension, for example "NDA-analysis" for "NDA.pdf". It is also the title that a printed page starts with,
// because many browsers offer the title of the page as the suggested name of a PDF.
export function reportBaseName(documentName: string): string {
  let name = "";
  let replaced = false;
  for (const character of oneLine(documentName).replace(/\.(pdf|docx)$/i, "")) {
    if (isUnsafe(character)) {
      if (replaced === false) {
        name += "_";
      }
      replaced = true;
    } else {
      name += character;
      replaced = false;
    }
  }

  // Cut by characters, not by the units of the string, so that a character is never cut in two.
  name = Array.from(name).slice(0, MAX_NAME_LENGTH).join("");
  // No dot at the start (the file would be hidden on macOS and Linux), and no space at either end.
  name = name.replace(/^[.\s]+/, "").replace(/\s+$/, "");

  if (/^[_\s.]*$/.test(name)) {
    return REPORT_SUFFIX.slice(1);
  }

  return name + REPORT_SUFFIX;
}

export function reportFileName(documentName: string): string {
  return reportBaseName(documentName) + REPORT_EXTENSION;
}
