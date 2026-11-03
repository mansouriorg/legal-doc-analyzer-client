import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the History page from going back to made-up data,
// and keep the layout fixes of update 7 from being undone by accident.

const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

describe("history page (app/dashboard/page.tsx): data", () => {
  it("is a server component that asks the server again on every visit", () => {
    assert.doesNotMatch(page, /"use client"/);
    assert.match(page, /export const dynamic = "force-dynamic";/);
    assert.match(page, /export default async function Dashboard\(\{ searchParams \}: DashboardProps\)/);
  });

  it("reads the list with listDocuments, inside try and catch, and writes the error to the log", () => {
    assert.match(page, /import \{ listDocuments \} from "@\/services\/api";/);
    assert.match(page, /try \{\s*list = await listDocuments\(\);\s*\} catch \(error\) \{\s*console\.error\(/);
  });

  it("has no made-up documents, no sample note, no fake status and no demo data", () => {
    assert.doesNotMatch(page, /documentHistory/);
    assert.doesNotMatch(page, /Sample data/);
    assert.doesNotMatch(page, /doc_10\d/);
    assert.doesNotMatch(page, /Vendor_Agreement|NDA_Freelance|Office_Lease|Software_Licensing/);
    assert.doesNotMatch(page, /Pending Reviews|Review Required|StatusBadge/);
    assert.doesNotMatch(page, /getDemoAnalysis/);
  });

  it("shows an alert and no rows when the list cannot be loaded", () => {
    assert.match(page, /<div role="alert"/);
    assert.match(page, /The saved analyses could not be loaded\./);
    assert.match(page, /\{stats === null \? \(\s*<LoadError message=\{loadError\} \/>/);
    assert.match(page, /const rows = list === null \? \[\] : list\.documents;/);
  });

  it("says so, and links to the upload page, when nothing is saved yet", () => {
    assert.match(page, /No analyses yet/);
    assert.match(page, /\{rows\.length === 0 \? \(\s*<EmptyHistory \/>\s*\) : \(/);
    assert.match(page, /\{shown\.length === 0 \? <NoMatches \/> : <HistoryList rows=\{shown\} \/>\}/);
    assert.match(page, /Analyze a document/);
  });

  it("works out the three numbers from the rows instead of writing fixed numbers", () => {
    assert.match(page, /summarizeHistory\(list\)/);
    assert.match(page, /Saved Analyses<\/p>\s*<p className="[^"]*">\{stats\.total\}<\/p>/);
    assert.match(page, /High Risk Clauses Found<\/p>\s*<p className="[^"]*">\{stats\.highRisks\}<\/p>/);
    assert.match(page, /Documents With High Risk<\/p>\s*<p className="[^"]*">\{stats\.withHighRisk\}<\/p>/);
    assert.doesNotMatch(page, />\s*124\s*</);
  });

  it("tells the person when some analyses are not shown or some files could not be read", () => {
    assert.match(page, /\{stats\.hidden > 0 \? \(\s*<div role="note"/);
    assert.match(page, /\{stats\.unreadable > 0 \? \(\s*<div role="note"/);
    assert.match(page, /Not all analyses are shown\./);
    assert.match(page, /The two risk numbers above count only the analyses shown\./);
    assert.match(page, /could not be read/);
  });

  it("puts those notes under the three numbers, which they explain", () => {
    assert.ok(page.indexOf("<StatCards stats={stats} />") > 0);
    assert.ok(page.indexOf("<StatCards stats={stats} />") < page.indexOf("<HistoryNotes stats={stats} />"));
    assert.ok(page.indexOf("<HistoryNotes stats={stats} />") < page.indexOf("<EmptyHistory />"));
  });
});

describe("history page (app/dashboard/page.tsx): rows", () => {
  it("opens the saved analysis from every row, in the cards and in the table", () => {
    assert.match(page, /import \{ HISTORY_PATH, filterHistory, readHistoryFilter, reportPath, riskBadges, summarizeHistory \} from "@\/services\/history";/);
    assert.match(page, /<Link href=\{reportPath\(doc\.id\)\}/);
    const links = page.match(/<ReportLink doc=\{doc\} \/>/g) || [];
    assert.equal(links.length, 2);
    assert.doesNotMatch(page, /<button/);
  });

  it("gives every link the name of its document for screen readers", () => {
    assert.match(page, /View Report<span className="sr-only"> for \{doc\.documentName\}<\/span>/);
  });

  it("shows the time on the clock of the person, through LocalTime (see tests/local-time.test.mjs)", () => {
    assert.match(page, /import LocalTime from "@\/components\/document\/LocalTime";/);
    assert.match(page, /return <LocalTime value=\{value\} fallback="Unknown date" \/>;/);
    const times = page.match(/<SavedTime value=\{doc\.savedAt\} \/>/g) || [];
    assert.equal(times.length, 2);
    assert.doesNotMatch(page, /toLocale|formatSavedAt|<time/);
  });

  it("writes the number and the word in each risk label, so the colour is not the only sign", () => {
    assert.match(page, /\{badge\.text\}/);
    assert.match(page, /High: "bg-red-100 text-red-800 border-red-200"/);
    assert.match(page, /Medium: "bg-amber-100 text-amber-800 border-amber-200"/);
    assert.match(page, /Low: "bg-emerald-100 text-emerald-800 border-emerald-200"/);
    assert.match(page, /No clauses/);
  });
});

describe("history page (app/dashboard/page.tsx): layout", () => {
  it("stacks the title and the upload button on small screens", () => {
    assert.match(page, /flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between/);
    assert.match(page, /self-start sm:self-auto shrink-0 whitespace-nowrap/);
  });

  it("shows one card per document below the lg size, and the table from lg up", () => {
    assert.match(page, /<ul className="lg:hidden /);
    assert.match(page, /<div className="hidden lg:block /);
    assert.match(page, /<table /);
  });

  it("names the table for screen readers and marks its column headers", () => {
    assert.match(page, /<caption className="sr-only">/);
    const headers = page.match(/<th scope="col"/g) || [];
    assert.equal(headers.length, 4);
    assert.doesNotMatch(page, /<th className=/);
  });

  it("keeps the date, the risk labels and the action on one line in the table, so a long name wraps instead", () => {
    assert.match(page, /px-6 text-sm text-slate-500 whitespace-nowrap">/);
    assert.match(page, /<div className="flex gap-2 whitespace-nowrap">/);
    assert.match(page, /px-6 text-right whitespace-nowrap">/);
  });

  it("lets long file names wrap in both layouts", () => {
    assert.match(page, /text-sm wrap-break-word">\{doc\.documentName\}/);
    assert.match(page, /text-sm wrap-anywhere">\{doc\.documentName\}/);
  });
});
