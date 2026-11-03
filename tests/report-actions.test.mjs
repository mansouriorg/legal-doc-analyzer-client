import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the two buttons that print or download an analysis, the print styles of the pages
// that show an analysis, and the part of the README that describes them in line with each other.
// What the downloaded text and the file name look like is tested in services/exportReport.test.mjs. Nothing here opens a browser.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const { REPORT_DISCLAIMER } = await import("../services/exportReport.ts");

const actions = read("../components/document/ReportActions.tsx");
const results = read("../components/document/AnalysisResults.tsx");
const savedPage = read("../app/documents/[id]/page.tsx");
const layout = read("../app/layout.tsx");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

describe("report buttons (components/document/ReportActions.tsx)", () => {
  it("is a client component that keeps one piece of state, the status text, and uses no effect", () => {
    assert.match(actions, /^"use client";/);
    assert.equal(count(actions, /useState\(/g), 1);
    assert.match(actions, /const \[status, setStatus\] = useState\(""\);/);
    assert.doesNotMatch(actions, /useEffect|useLayoutEffect/);
  });

  it("has two buttons of the type button, called Print or save as PDF and Download as text, in this order", () => {
    assert.equal(count(actions, /<button\b/g), 2);
    assert.equal(count(actions, /<button type="button"/g), 2);
    assert.match(actions, /<button type="button" onClick=\{printReport\} className=\{BUTTON_CLASS\}>\s*Print or save as PDF\s*<\/button>\s*<button type="button" onClick=\{downloadReport\} className=\{BUTTON_CLASS\}>\s*Download as text\s*<\/button>\s*\{children\}/);
  });

  it("prints with the print window of the browser, and uses the name of the report as the title while the window is open", () => {
    assert.match(actions, /const previousTitle = document\.title;\s*document\.title = reportBaseName\(data\.documentName\);\s*try \{\s*window\.print\(\);\s*\} finally \{\s*document\.title = previousTitle;\s*\}/);
    assert.equal(count(actions, /window\.print\(\)/g), 1);
  });

  it("downloads a plain text file made in the browser, with the name from reportFileName", () => {
    assert.match(actions, /const fileName = reportFileName\(data\.documentName\);/);
    assert.match(actions, /const text = buildReportText\(data, \{ notes, savedAt: formatLocalTime\(data\.savedAt\) \}\);/);
    assert.match(actions, /new Blob\(\[text\], \{ type: "text\/plain;charset=utf-8" \}\)/);
    assert.match(actions, /link\.download = fileName;/);
    assert.match(actions, /document\.body\.appendChild\(link\);\s*link\.click\(\);\s*link\.remove\(\);/);
  });

  it("gives the address of the file back to the browser after ten seconds, not at once, because some browsers still need it", () => {
    assert.match(actions, /window\.setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 10000\);/);
    assert.equal(count(actions, /revokeObjectURL/g), 1);
  });

  it("writes the time of saving on the clock of the computer, as the page does", () => {
    assert.match(actions, /import \{ formatLocalTime \} from "@\/services\/history";/);
    assert.doesNotMatch(actions, /toLocale/);
  });

  it("sends nothing to the server and opens no dialog of the browser", () => {
    assert.doesNotMatch(actions, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|@\/services\/api/);
    assert.doesNotMatch(actions, /alert\(|confirm\(|prompt\(/);
    assert.doesNotMatch(actions, /dangerouslySetInnerHTML|innerHTML/);
  });

  it("says in a status text what happened, also when the file could not be made, and logs the reason", () => {
    assert.match(actions, /<p role="status" className="[^"]*">\s*\{status\}\s*<\/p>/);
    assert.match(actions, /setStatus\(`File ready: \$\{fileName\}\. Your browser saves it, usually in the downloads folder\.`\);/);
    assert.match(actions, /setStatus\("The file could not be made\. You can use Print or save as PDF instead\."\);/);
    assert.match(actions, /console\.error\("Could not make the file:", error\);/);
  });

  it("lets the row of buttons wrap and a long status text break, so nothing is pushed off a narrow screen", () => {
    assert.match(actions, /<div className="flex flex-wrap gap-2">/);
    assert.match(actions, /<p role="status" className="text-xs text-slate-600 wrap-break-word">/);
  });

  it("uses only colours that are easy to read on white, and no dark mode colours", () => {
    assert.doesNotMatch(actions, /\bdark:/);
    assert.doesNotMatch(actions, /text-gray-400|text-slate-400|text-slate-300|text-white/);
    assert.match(actions, /text-slate-700 bg-white border border-slate-300/);
  });
});

describe("results (components/document/AnalysisResults.tsx): the buttons", () => {
  it("shows the buttons in the header, with the Analyze Another Document button of the upload page in the same row", () => {
    assert.match(results, /import ReportActions from "@\/components\/document\/ReportActions";/);
    assert.match(results, /<ReportActions data=\{data\} notes=\{notes\}>\s*\{onReset \? \(\s*<button\s+onClick=\{onReset\}/);
    assert.equal(count(results, /<ReportActions\b/g), 1);
    assert.ok(results.indexOf("Header and Controls") < results.indexOf("<ReportActions"));
    assert.ok(results.indexOf("<ReportActions") < results.indexOf("Analyze Another Document"));
  });

  it("does not print the buttons", () => {
    assert.match(results, /<div className="self-start sm:self-auto print:hidden">\s*<ReportActions /);
  });
});

describe("results (components/document/AnalysisResults.tsx): the print layout", () => {
  it("lets the page grow in print, where the upload page has a fixed height from the lg size up", () => {
    assert.match(results, /"lg:h-\[85vh\] print:h-auto"/);
  });

  it("prints the two sides in one column, without clipping, because print can be wider than 1024 px (A4 landscape)", () => {
    assert.match(results, /"lg:grid-cols-2 lg:overflow-hidden print:grid-cols-1 print:overflow-visible"/);
    assert.match(results, /"lg:overflow-y-auto lg:pr-2 print:overflow-visible"/);
    assert.match(results, /"lg:sticky lg:top-0 lg:z-10 print:static"/);
  });

  it("gives every class that clips, scrolls or pins from the lg size up a print class that undoes it", () => {
    const pairs = [
      [/lg:h-\[85vh\]/g, /print:h-auto/g],
      [/lg:sticky/g, /print:static/g],
      [/lg:grid-cols-2/g, /print:grid-cols-1/g],
      [/lg:overflow-hidden|lg:overflow-y-auto/g, /print:overflow-visible/g],
    ];
    for (const [big, print] of pairs) {
      assert.equal(count(results, big), count(results, print), String(big));
      assert.ok(count(results, big) > 0, String(big));
    }
  });

  it("leaves out the preview of the original document", () => {
    assert.match(results, /<div className="order-2 lg:order-1 h-96 lg:h-auto [^"]* flex flex-col print:hidden">/);
  });

  it("keeps a clause on one page when it fits", () => {
    assert.match(results, /hover:border-blue-300 transition-colors wrap-break-word print:break-inside-avoid">/);
  });

  it("ends a printed page with the warning, which is not on the screen", () => {
    assert.match(results, /import \{ REPORT_DISCLAIMER \} from "@\/services\/exportReport";/);
    assert.match(results, /<p className="hidden print:block text-xs text-slate-600">\{REPORT_DISCLAIMER\}<\/p>/);
    assert.ok(results.indexOf("{REPORT_DISCLAIMER}") > results.indexOf("data.clauses.map"));
    assert.match(REPORT_DISCLAIMER, /first reading by an AI model/);
    assert.match(REPORT_DISCLAIMER, /not legal advice/);
  });

  it("hides nothing else in print: the summary, the notes, the title and the clauses are printed", () => {
    assert.equal(count(results, /print:hidden/g), 3);
    for (const marker of ["Executive Summary", "Extracted Clauses", "data.documentName", "notes.map"]) {
      const line = results.split("\n").find((candidate) => candidate.includes(marker));
      assert.ok(line, "no line contains: " + marker);
      assert.doesNotMatch(line, /print:hidden/);
    }
  });
});

describe("what a printed page leaves out (app/layout.tsx and app/documents/[id]/page.tsx)", () => {
  it("leaves out the navigation bar", () => {
    assert.match(layout, /<nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">/);
    assert.equal(count(layout, /print:hidden/g), 1);
  });

  it("leaves out the link back, the link to the question box, the Delete button and the question box", () => {
    assert.match(savedPage, /<Link href="\/dashboard" className="mb-3 inline-block [^"]*print:hidden">/);
    assert.match(savedPage, /<p className="mt-3 print:hidden">\s*<a href="#ask"/);
    assert.match(savedPage, /<div className="mt-4 print:hidden">\s*<DeleteDocumentButton /);
    assert.match(savedPage, /<div id="ask" className="[^"]*print:hidden">\s*<DocumentChat /);
    assert.equal(count(savedPage, /print:hidden/g), 4);
  });

  it("prints the title, the document ID and the analysis", () => {
    for (const marker of ["<h1", "Document ID:", "<AnalysisResults"]) {
      const line = savedPage.split("\n").find((candidate) => candidate.includes(marker));
      assert.ok(line, "no line contains: " + marker);
      assert.doesNotMatch(line, /print:hidden/);
    }
  });

  it("is the only place that hides things in print: no other file in the app or the components uses print:hidden", () => {
    for (const path of ["../app/page.tsx", "../app/dashboard/page.tsx", "../components/document/DocumentChat.tsx", "../components/document/LocalTime.tsx", "../components/document/DeleteDocumentButton.tsx"]) {
      assert.equal(read(path).includes("print:"), false, path);
    }
  });
});

describe("README: printing and downloading an analysis", () => {
  it("has the section once, between the results page and the notes", () => {
    assert.equal(count(readme, /^## Printing and downloading an analysis$/gm), 1);
    assert.ok(readme.indexOf("## Results page") < readme.indexOf("## Printing and downloading an analysis"));
    assert.ok(readme.indexOf("## Printing and downloading an analysis") < readme.indexOf("## Notes about an analysis"));
  });

  it("names the two buttons as the page has them, and the file that makes them", () => {
    assert.match(readme, /two buttons at the top, next to the title of the document: "Print or save as PDF" and "Download as text"/);
    assert.match(readme, /They are made by `components\/document\/ReportActions\.tsx`\./);
    assert.match(readme, /At the top of the results there are two buttons, "Print or save as PDF" and "Download as text"/);
  });

  it("says that nothing is sent to the server, and that the buttons also work for an analysis that was not kept", () => {
    assert.match(readme, /Nothing is sent to the server: both buttons use the analysis that the page already has, so they also work for an analysis that was not kept\./);
  });

  it("says what a printout leaves out, what it keeps, and how to get a PDF", () => {
    assert.match(readme, /The navigation bar, the buttons, the link back to the history, the Delete button, the question box and the preview of the original document are left out of the printout\./);
    assert.match(readme, /The notes, the summary and every clause are printed in one column, and a clause is not split between two pages when it fits on one\./);
    assert.match(readme, /The last line is the warning that this is a first reading by an AI model and not legal advice\./);
    assert.match(readme, /To get a PDF, choose "Save as PDF" as the printer\./);
    assert.match(readme, /the title of the page is the name of the report \(for example "NDA-analysis"\)\. Many browsers offer the title of the page as the suggested name of the PDF, but this depends on the browser\./);
    assert.doesNotMatch(readme, /so most browsers offer it/);
  });

  it("says what the text file holds, and where the functions are", () => {
    assert.match(readme, /"Download as text" saves a plain text file, for example `NDA-analysis\.txt`\./);
    assert.match(readme, /the name of the document, when it was saved \(on the clock of the computer, as on the page\), the document ID, the notes, the summary, and every clause with its risk, its original text and its implication/);
    assert.match(readme, /a line at the top says so when the analysis is the built-in demo example/);
    assert.match(readme, /The functions that write the text and the file name are in `services\/exportReport\.ts`\./);
  });

  it("states the rules of the file name as the code has them", () => {
    assert.match(readme, /A character that a file system refuses is replaced by `_`, at most 80 characters of the name of the document are used, and a name always ends with `-analysis\.txt`\./);
  });

  it("says that the questions and answers are not part of the printout or the file", () => {
    assert.match(readme, /The questions and answers of the question box are not in the printout or in the file\. The page does not save them either\./);
  });

  it("is named in the Tests paragraph and in the test script of package.json", () => {
    const tests = readme.slice(readme.indexOf("## Tests"));
    assert.match(tests, /`services\/exportReport\.test\.mjs` tests the text of a downloaded analysis and its file name\./);
    assert.match(tests, /`tests\/report-actions\.test\.mjs` keeps the two buttons, the print styles and the description in this README in line with each other\. The tests do not open a browser\./);
    const named = pkg.scripts.test.split(" ");
    assert.ok(named.includes("services/exportReport.test.mjs"));
    assert.ok(named.includes("tests/report-actions.test.mjs"));
  });
});
