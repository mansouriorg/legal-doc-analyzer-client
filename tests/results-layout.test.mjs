import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the fixes of update 5 from being undone by accident.
// "Unprefixed" below means a class that applies on every screen size, for example overflow-hidden.
// "lg:" means the class applies only from the large size (1024 px) up.

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

// A class that is written without a size prefix, such as " overflow-hidden" but not "lg:overflow-hidden".
function unprefixed(className) {
  return new RegExp("(?:^|[\\s\"'])" + className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[\\s\"'])");
}

function lineWith(source, text) {
  const line = source.split("\n").find((candidate) => candidate.includes(text));
  assert.ok(line, "no line contains: " + text);
  return line;
}

describe("results page (components/document/AnalysisResults.tsx)", () => {
  const source = read("../components/document/AnalysisResults.tsx");

  it("has a fixed height only from the lg size up, so phones scroll the whole page", () => {
    assert.doesNotMatch(source, unprefixed("h-[85vh]"));
    assert.match(source, /lg:h-\[85vh\]/);
  });

  it("clips and scrolls the two sides only from the lg size up", () => {
    const grid = lineWith(source, "grid-cols-1");
    assert.doesNotMatch(grid, unprefixed("overflow-hidden"));
    assert.match(grid, /lg:overflow-hidden/);

    const column = lineWith(source, "lg:order-2");
    assert.doesNotMatch(column, unprefixed("overflow-y-auto"));
    assert.match(column, /lg:overflow-y-auto/);
  });

  it("pins the summary only from the lg size up, where its column scrolls", () => {
    assert.doesNotMatch(source, unprefixed("sticky"));
    assert.match(source, /lg:sticky/);
  });

  it("shows the results before the preview on small screens", () => {
    assert.match(lineWith(source, "lg:order-1"), /order-2 lg:order-1/);
    assert.match(lineWith(source, "lg:order-2"), /order-1 lg:order-2/);
  });

  it("stacks the title and the button on small screens, and lets a long file name wrap", () => {
    assert.match(source, /flex flex-col gap-3 sm:flex-row/);
    assert.match(source, /<div className="min-w-0">/);
    assert.match(lineWith(source, "<h2"), /wrap-break-word/);
    assert.match(lineWith(source, "<h4"), /min-w-0/);
  });

  it("keeps the risk label on one line and lets clause text wrap", () => {
    assert.match(lineWith(source, "getRiskColor(clause.riskLevel)"), /shrink-0 whitespace-nowrap/);
    assert.match(lineWith(source, "hover:border-blue-300"), /wrap-break-word/);
  });

  it("shows the preview frame only for PDF files and says so for other files", () => {
    assert.match(source, /from "@\/services\/previewRules"/);
    assert.match(source, /canPreviewFile\(file\)/);
    assert.match(source, /Only PDF files can be shown here/);
  });

  it("shows no empty preview pane for a saved document that has no file", () => {
    assert.match(source, /const hasFile = file !== undefined && file !== null;/);
    assert.match(source, /hasFile \? \(/);
    assert.doesNotMatch(source, /No preview is available for this document/);
  });

  it("shows the notes of the server in a box above the title, only when there are notes", () => {
    assert.match(source, /import \{ cleanNotes \} from "@\/services\/api";/);
    assert.match(source, /const notes = cleanNotes\(data\.notes\);/);
    assert.match(source, /\{notes\.length > 0 \? \(/);
    assert.match(source, /<li key=\{note\}>\{note\}<\/li>/);
    assert.match(source, /\{notes\.length > 0 \? \(\s*<div role="note"/);
    assert.match(lineWith(source, "Note about this analysis"), /Notes about this analysis/);
    assert.ok(source.indexOf("Notes about this analysis") < source.indexOf("Header and Controls"));
    assert.match(lineWith(source, "<ul className=\"mt-1 list-disc"), /wrap-break-word/);
    // Dark text on the light amber background, as in the demo banner, so that it stays easy to read.
    assert.match(lineWith(source, "role=\"note\" className=\"mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-9"), /text-amber-900/);
  });

  it("shows when the server saved the analysis, on the clock of the person, only when it sent a usable time", () => {
    assert.match(source, /import \{ formatSavedAt \} from "@\/services\/history";/);
    assert.match(source, /import LocalTime from "@\/components\/document\/LocalTime";/);
    assert.match(source, /const savedAt = formatSavedAt\(data\.savedAt\) === null \? undefined : data\.savedAt;/);
    assert.match(source, /\{savedAt === undefined \? null : <> &middot; Saved <LocalTime value=\{savedAt\} \/><\/>\}/);
    assert.doesNotMatch(source, /toLocale/);
  });

  it("no longer uses the custom-scrollbar class, which was not defined anywhere", () => {
    assert.doesNotMatch(source, /custom-scrollbar/);
  });
});

describe("saved document page (app/documents/[id]/page.tsx)", () => {
  const page = read("../app/documents/[id]/page.tsx");

  it("has no dark mode colours, because the app is light only (white text would vanish)", () => {
    assert.doesNotMatch(page, /dark:/);
  });

  it("lets a long document id wrap", () => {
    assert.match(lineWith(page, "<p className=\"text-sm text-gray-500 mt-2"), /wrap-break-word/);
  });

  it("has a link back to the history page", () => {
    assert.match(page, /import Link from "next\/link";/);
    assert.match(page, /<Link href="\/dashboard" className="mb-3 inline-block /);
    assert.match(page, /&larr; Back to history/);
  });
});
