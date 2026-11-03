import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the search form of the History page, the page that uses it and the README in line with each other.
// What the search finds is tested in services/history.test.mjs. Nothing here opens a browser.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const { AFTER_DELETE_PATH } = await import("../services/deleteFlow.ts");
const { HISTORY_PATH, MAX_SEARCH_LENGTH, RISK_CHOICES, RISK_PARAM, SEARCH_PARAM } = await import("../services/history.ts");

const form = read("../components/document/HistoryFilterForm.tsx");
const page = read("../app/dashboard/page.tsx");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

describe("the names that the form and the page share (services/history.ts)", () => {
  it("send the choices to the History page, in the parts q and risk, with at most 100 characters of search text", () => {
    assert.equal(HISTORY_PATH, "/dashboard");
    assert.equal(HISTORY_PATH, AFTER_DELETE_PATH);
    assert.equal(SEARCH_PARAM, "q");
    assert.equal(RISK_PARAM, "risk");
    assert.equal(MAX_SEARCH_LENGTH, 100);
  });

  it("have four risk choices, each with a value and a label that say what they find", () => {
    assert.deepEqual(RISK_CHOICES.map((choice) => choice.value), ["high", "medium", "low", "none"]);
    assert.deepEqual(RISK_CHOICES.map((choice) => choice.label), ["With High risk clauses", "With Medium risk clauses", "With Low risk clauses", "Without clauses"]);
  });
});

describe("search form (components/document/HistoryFilterForm.tsx)", () => {
  it("is a server component without state, because the form is a plain page request", () => {
    assert.doesNotMatch(form, /"use client"/);
    assert.doesNotMatch(form, /useState|useEffect|useReducer|onChange|onSubmit|onClick/);
  });

  it("is a GET form to the History page, named as a search for screen readers", () => {
    assert.match(form, /<form action=\{HISTORY_PATH\} method="get" role="search" aria-label="Search the saved analyses"/);
    assert.equal(count(form, /<form\b/g), 1);
  });

  it("has a box for the file name, with a visible label, the name q, the text of the address and a length limit", () => {
    assert.match(form, /<label htmlFor="history-search"[^>]*>\s*Search by file name\s*<\/label>/);
    assert.match(form, /<input\s+id="history-search"\s+name=\{SEARCH_PARAM\}\s+type="search"\s+defaultValue=\{filter\.query\}\s+maxLength=\{MAX_SEARCH_LENGTH\}\s+autoComplete="off"/);
    assert.doesNotMatch(form, /name="q"|name="risk"/);
  });

  it("has a list for the risk, with a visible label, the first choice All analyses and the other choices from the services", () => {
    assert.match(form, /<label htmlFor="history-risk"[^>]*>\s*Risk\s*<\/label>/);
    assert.match(form, /<select\s+id="history-risk"\s+name=\{RISK_PARAM\}\s+defaultValue=\{filter\.risk \?\? ""\}/);
    assert.match(form, /<option value="">All analyses<\/option>\s*\{RISK_CHOICES\.map\(\(choice\) => \(\s*<option key=\{choice\.value\} value=\{choice\.value\}>\s*\{choice\.label\}\s*<\/option>\s*\)\)\}/);
    assert.equal(count(form, /<option\b/g), 2);
  });

  it("has one button, a submit button called Search", () => {
    assert.equal(count(form, /<button\b/g), 1);
    assert.match(form, /<button\s+type="submit"[^>]*>\s*Search\s*<\/button>/);
  });

  it("shows a link Clear to the History page only while a search or a risk choice is active", () => {
    assert.match(form, /const filtering = isFiltering\(filter\);/);
    assert.match(form, /\{filtering \? \(\s*<Link href=\{HISTORY_PATH\}[^>]*>\s*Clear\s*<\/Link>\s*\) : null\}/);
  });

  it("says how many analyses are shown only while a search is active, and says what the search covers when some are not in the list", () => {
    assert.match(form, /const scopeNote = searchScopeNote\(listed, hidden\);/);
    assert.match(form, /\{filtering \? <p className="[^"]*">\{describeFilterResult\(shown, listed\)\}<\/p> : null\}/);
    assert.match(form, /\{scopeNote === null \? null : <p className="[^"]*">\{scopeNote\}<\/p>\}/);
  });

  it("uses light colours with enough contrast, and no dark mode colours", () => {
    assert.doesNotMatch(form, /\bdark:/);
    assert.doesNotMatch(form, /text-gray-400|text-slate-400|text-slate-300/);
    assert.match(form, /placeholder:text-slate-500/);
  });
});

describe("History page (app/dashboard/page.tsx): search and filter", () => {
  it("reads the choices from the address with readHistoryFilter, and picks the rows with filterHistory", () => {
    assert.match(page, /import HistoryFilterForm from "@\/components\/document\/HistoryFilterForm";/);
    assert.match(page, /import \{ HISTORY_PATH, filterHistory, readHistoryFilter, reportPath, riskBadges, summarizeHistory \} from "@\/services\/history";/);
    assert.match(page, /const filter = readHistoryFilter\(params\);/);
    assert.match(page, /const shown = filterHistory\(rows, filter\);/);
  });

  it("shows the form above the list when there are rows, and the filtered rows below it", () => {
    assert.match(
      page,
      /\{rows\.length === 0 \? \(\s*<EmptyHistory \/>\s*\) : \(\s*<>\s*<HistoryFilterForm filter=\{filter\} shown=\{shown\.length\} listed=\{rows\.length\} hidden=\{stats\.hidden\} \/>\s*\{shown\.length === 0 \? <NoMatches \/> : <HistoryList rows=\{shown\} \/>\}\s*<\/>\s*\)\}/,
    );
    assert.ok(page.indexOf("<HistoryNotes stats={stats} />") < page.indexOf("<HistoryFilterForm"));
    assert.ok(page.indexOf("<HistoryFilterForm") < page.indexOf("<HistoryList rows={shown} />"));
  });

  it("still works out the three numbers and the notes from all the rows, not from the filtered ones", () => {
    assert.match(page, /const stats = list === null \? null : summarizeHistory\(list\);/);
    assert.match(page, /<StatCards stats=\{stats\} \/>\s*<HistoryNotes stats=\{stats\} \/>/);
  });

  it("says so, with a link to all analyses, when nothing matches", () => {
    assert.match(page, /function NoMatches\(\) \{/);
    assert.match(page, /No analysis matches/);
    assert.match(page, /<Link href=\{HISTORY_PATH\}[^>]*>\s*Show all analyses\s*<\/Link>/);
  });

  it("is still a server component with no button of its own", () => {
    assert.doesNotMatch(page, /"use client"/);
    assert.doesNotMatch(page, /<button/);
  });

  it("no longer says that every analysis is saved, because the person can choose not to keep one", () => {
    assert.equal(page.includes("Every analysis is saved by the server"), false);
    assert.equal(page.includes("Every document you analyze is saved by the server"), false);
    assert.match(page, /The analyses that the server saved are listed here\./);
    assert.match(page, /Each analysis that the server saves appears here\. An analysis you chose not to keep is not saved, so it is not listed\./);
  });
});

describe("README: search and filter in the History list", () => {
  it("describes the form, its two controls and the risk choices", () => {
    assert.match(readme, /Above the list there is a form to search the analyses \(`components\/document\/HistoryFilterForm\.tsx`\)/);
    assert.match(readme, /a box "Search by file name" and a list "Risk" with the choices "All analyses", "With High risk clauses", "With Medium risk clauses", "With Low risk clauses" and "Without clauses"/);
    for (const choice of RISK_CHOICES) {
      assert.ok(readme.includes('"' + choice.label + '"'), "the README does not list: " + choice.label);
    }
  });

  it("says how several words, capital letters and accents are treated, and the length limit", () => {
    assert.match(readme, /A search with several words finds the file names that contain all of them, in any order\./);
    assert.match(readme, /Capital letters and accents do not matter/);
    assert.match(readme, /The search text is cut to 100 characters\./);
  });

  it("says that the form is a plain GET form with the address, and where the work is done", () => {
    assert.match(readme, /The form is a plain GET form: Search opens `\/dashboard\?q=\.\.\.&risk=\.\.\.`, so it needs no JavaScript/);
    assert.match(readme, /`readHistoryFilter` and picks the rows with `filterHistory` \(both in `services\/history\.ts`\)/);
    assert.match(readme, /A risk value that is not `high`, `medium`, `low` or `none` is ignored\./);
  });

  it("says that only the list is filtered, what is shown, and what the search covers", () => {
    assert.match(readme, /Only the list is filtered\. The three numbers and the notes under them still describe all saved analyses\./);
    assert.match(readme, /"Showing 2 of 12 analyses in the list\." says how many rows are shown/);
    assert.match(readme, /"No analysis matches" appears when none is/);
    assert.match(readme, /The search covers only the analyses in the list \(the newest ones, at most 100\)/);
  });

  it("says that a deletion opens the History page without the search, and what the tests do not do", () => {
    assert.match(readme, /Deleting an analysis opens the History page without the search\./);
    assert.match(readme, /The tests do not open a browser\./);
  });

  it("is named in the test script of package.json", () => {
    assert.ok(pkg.scripts.test.split(" ").includes("tests/history-filter.test.mjs"));
  });
});
