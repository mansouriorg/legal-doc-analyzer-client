import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the box "Delete the saved copy now" (components/document/DeleteSavedCopy.tsx) safe, keep it in its place on the upload page,
// and keep the README true to it. The two functions that the page uses are tested in services/savedCopy.test.mjs,
// the steps in services/deleteFlow.test.mjs and the call to the server in services/api.test.mjs. Nothing here opens a page in a browser.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const box = read("../components/document/DeleteSavedCopy.tsx");
const page = read("../app/page.tsx");
const results = read("../components/document/AnalysisResults.tsx");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

// The part of the README between a heading and the next heading.
function section(heading) {
  const start = readme.indexOf("\n## " + heading + "\n");
  assert.notEqual(start, -1, "the README has no section " + heading);
  const next = readme.indexOf("\n## ", start + 1);
  assert.notEqual(next, -1, "the section " + heading + " has no section after it");
  return readme.slice(start, next);
}

describe("saved copy box (components/document/DeleteSavedCopy.tsx): nothing is deleted by accident", () => {
  it("is a client component, because it reacts to clicks", () => {
    assert.match(box, /^"use client";/);
  });

  it("asks the server in one place only, and only after the person clicks the red button", () => {
    assert.equal(count(box, /deleteDocument\(/g), 1);
    assert.match(box, /async function confirmDelete\(\) \{[\s\S]*await deleteDocument\(documentId\)/);
    assert.equal(count(box, /onClick=\{confirmDelete\}/g), 1);
  });

  it("opens only the question when the first button is clicked", () => {
    assert.equal(count(box, /onClick=\{\(\) => dispatch\(\{ type: "ask" \}\)\}/g), 1);
    assert.match(box, /Delete the saved copy now/);
  });

  it("does nothing when the red button is clicked while a request runs, or before the question", () => {
    assert.match(box, /if \(state\.step !== "confirming" && state\.step !== "failed"\) \{\s*return;\s*\}\s*dispatch\(\{ type: "confirm" \}\);/);
    assert.equal(count(box, /disabled=\{busy\}/g), 2, "both the red button and Cancel are disabled while a request runs");
    assert.match(box, /onClick=\{confirmDelete\}\s+disabled=\{busy\}/);
    assert.match(box, /const busy = state\.step === "deleting" \|\| state\.step === "done";/);
  });

  it("uses the steps and the texts of services/deleteFlow.ts, and has no step of its own", () => {
    assert.match(box, /useReducer\(nextDeleteState, START_STATE\)/);
    assert.match(box, /import \{ START_STATE, confirmLabel, copyStatusText, nextDeleteState \} from "@\/services\/deleteFlow";/);
    assert.match(box, /import \{ deleteDocument \} from "@\/services\/api";/);
    assert.match(box, /const status = copyStatusText\(state\);/);
    assert.match(box, /\{confirmLabel\(state\)\}/);
  });

  it("tells the person that deleting cannot be undone, that the analysis stays on the page, and that the original file is not changed", () => {
    assert.match(box, /<p id=\{headingId\} className=\{done \? "sr-only" : "font-semibold"\}>Delete the saved copy\?<\/p>/);
    assert.match(box, /will be deleted from the server\. This cannot be undone\./);
    assert.match(box, /The analysis stays on this page until you leave it, and your original file is not changed\./);
  });

  it("shows the name of the document as text, never as HTML", () => {
    assert.match(box, /&ldquo;\{documentName\}&rdquo;/);
    assert.doesNotMatch(box, /dangerouslySetInnerHTML|innerHTML/);
  });

  it("uses no dialog of the browser, which cannot be styled and blocks the page", () => {
    assert.doesNotMatch(box, /window\.(confirm|alert|prompt)|\b(confirm|alert|prompt)\(/);
  });

  it("gives every button the type button, so that it can never submit a form", () => {
    const buttons = count(box, /<button\b/g);
    assert.ok(buttons >= 3, "too few buttons were found, so this check no longer tests anything");
    assert.equal(count(box, /type="button"/g), buttons);
  });
});

describe("saved copy box: what happens after the answer of the server", () => {
  it("does not leave the page: no page change and no link", () => {
    assert.doesNotMatch(box, /window\.location|location\.assign|useRouter|router\.|redirect|href=|<Link\b|next\/link|next\/navigation/);
  });

  it("tells the page once, and only after the server has answered with success", () => {
    assert.equal(count(box, /onDeleted\(\)/g), 1);
    assert.match(box, /dispatch\(\{ type: "succeeded", outcome \}\);\s*onDeleted\(\);\s*\}/);
    const failure = box.slice(box.indexOf("} catch (error) {"), box.indexOf('dispatch({ type: "succeeded", outcome });'));
    assert.ok(failure.includes("return;"), "the failure branch does not stop");
    assert.equal(failure.includes("onDeleted"), false);
  });

  it("stays on the page and shows the error when the call fails, with Try again and Cancel", () => {
    assert.match(box, /dispatch\(\{\s*type: "failed",\s*message: error instanceof Error && error\.message !== "" \? error\.message : NOT_DELETED_TEXT,\s*\}\);/);
    assert.match(box, /<p role="alert"[^>]*>\s*<span className="font-semibold">The saved copy was not deleted\.<\/span> \{state\.message\}\s*<\/p>/);
    assert.match(box, /Cancel\s*<\/button>/);
  });

  it("does not show the question again once the copy is deleted, because it is no longer true", () => {
    assert.match(box, /\{done \? null : \(\s*<p className="mt-1 wrap-break-word">/);
    assert.match(box, /\{done \? null : \(\s*<div className="mt-3 flex flex-wrap gap-2">/);
  });
});

describe("saved copy box: keyboard and screen readers", () => {
  it("puts the focus on Cancel when the question opens, and back on the first button when it closes", () => {
    assert.match(box, /if \(state\.step === "confirming" \|\| state\.step === "failed"\) \{\s*cancelRef\.current\?\.focus\(\);/);
    assert.match(box, /else if \(state\.step === "idle" && wasOpen\.current\) \{\s*triggerRef\.current\?\.focus\(\);/);
    assert.match(box, /ref=\{triggerRef\}/);
    assert.match(box, /ref=\{cancelRef\}/);
  });

  it("closes the question with the Escape key, but not while the request runs", () => {
    assert.match(box, /event\.key === "Escape" && \(state\.step === "confirming" \|\| state\.step === "failed"\)/);
    assert.match(box, /onKeyDown=\{closeWithEscape\}/);
  });

  it("names the question as a group, announces the progress politely and an error as an alert", () => {
    assert.match(box, /role="group"\s+aria-labelledby=\{headingId\}/);
    assert.match(box, /<p role="status" aria-live="polite" className=\{statusClass\}>/);
    assert.equal(count(box, /role="alert"/g), 1);
  });

  it("hides the icon from screen readers", () => {
    assert.match(box, /<svg [^>]*aria-hidden="true"/);
  });

  it("has no dark mode colours, because the app is light only, and no colours with too little contrast", () => {
    assert.doesNotMatch(box, /dark:/);
    assert.doesNotMatch(box, /text-gray-400|text-slate-400|text-slate-300|text-red-300|text-emerald-300/);
  });
});

describe("upload page (app/page.tsx): the box", () => {
  it("imports the box and the two functions of the API service", () => {
    assert.match(page, /import \{ analyzeDocument, getDemoAnalysis, savedAgainstChoice, withoutSavedCopy \} from "@\/services\/api";/);
    assert.match(page, /import DeleteSavedCopy from "@\/components\/document\/DeleteSavedCopy";/);
  });

  it("keeps the id of the saved copy in a state that starts empty", () => {
    assert.match(page, /const \[savedCopyId, setSavedCopyId\] = useState<string \| null>\(null\);/);
  });

  it("sets it when the answer comes in, from the choice of the person and the answer, and nowhere else", () => {
    assert.equal(count(page, /savedAgainstChoice\(/g), 1);
    assert.match(page, /setAnalysisData\(result\);\s*setSavedCopyId\(savedAgainstChoice\(result, doNotKeep\)\);/);
    assert.equal(count(page, /setSavedCopyId\(/g), 2);
  });

  it("shows the box only when there is a saved copy, in the place that AnalysisResults gives it", () => {
    assert.match(page, /notice=\{\s*savedCopyId === null \? null : \(\s*<DeleteSavedCopy\s+key=\{savedCopyId\}\s+documentId=\{savedCopyId\}\s+documentName=\{analysisData\.documentName\}/);
    assert.equal(count(page, /<DeleteSavedCopy\b/g), 1);
  });

  it("changes only the analysis that has the id of the deleted copy", () => {
    assert.match(page, /onDeleted=\{\(\) =>\s*setAnalysisData\(\(current\) => \(current !== null && current\.id === savedCopyId \? withoutSavedCopy\(current\) : current\)\)\s*\}/);
  });

  it("forgets the saved copy when the person goes back to the upload screen", () => {
    const start = page.indexOf("onReset={() => {");
    assert.ok(start > -1, "onReset was not found");
    const reset = page.slice(start, page.indexOf("}}", start));
    assert.match(reset, /setAnalysisData\(null\);\s*setSavedCopyId\(null\);/);
    assert.doesNotMatch(reset, /setDoNotKeep/);
  });

  it("does not show the box for the demo example, which was not saved", () => {
    const start = page.indexOf("setAnalysisData(getDemoAnalysis());");
    assert.ok(start > -1, "the demo button was not found");
    const demo = page.slice(start, page.indexOf("}}", start));
    assert.doesNotMatch(demo, /setSavedCopyId/);
  });

  it("still sends the choice with the file in the same way (see tests/keep-choice.test.mjs)", () => {
    assert.match(page, /await analyzeDocument\(file, \{ keep: doNotKeep === false, signal: controller\.signal \}\)/);
  });

  it("is the only place with the box: the results, the History page, the saved report page and the question box have none", () => {
    for (const path of ["../components/document/AnalysisResults.tsx", "../app/dashboard/page.tsx", "../app/documents/[id]/page.tsx", "../components/document/DocumentChat.tsx", "../components/document/HistoryRowActions.tsx", "../components/document/DeleteDocumentButton.tsx"]) {
      assert.doesNotMatch(read(path), /DeleteSavedCopy/, path);
    }
  });

  it("has no print class of its own, because the results component hides the box in print", () => {
    assert.equal(page.includes("print:"), false);
    assert.equal(box.includes("print:"), false);
  });
});

describe("results (components/document/AnalysisResults.tsx): the place for the box", () => {
  it("takes an optional notice, which can be any React content", () => {
    assert.match(results, /import type \{ ReactNode \} from "react";/);
    assert.match(results, /notice\?: ReactNode;/);
    assert.match(results, /export default function AnalysisResults\(\{ data, file, onReset, notice \}: AnalysisResultsProps\)/);
  });

  it("shows it between the notes and the title, only when there is one, and does not print it", () => {
    assert.match(results, /\{notice === undefined \|\| notice === null \? null : <div className="mb-4 print:hidden">\{notice\}<\/div>\}/);
    assert.ok(results.indexOf("notes.map") < results.indexOf("{notice}"), "the notice is above the notes");
    assert.ok(results.indexOf("{notice}") < results.indexOf("data.documentName"), "the notice is below the title");
  });

  it("does not know what the box is, so the saved report page and any other user of it are not changed", () => {
    assert.equal(results.includes("DeleteSavedCopy"), false);
    assert.equal(read("../app/documents/[id]/page.tsx").includes("notice="), false);
  });
});

describe("README: the Delete button of the upload page", () => {
  it("describes the box, its button, the file and the call that it uses", () => {
    const text = section("Deleting a saved analysis");
    assert.match(text, /^- The upload page has a third Delete button, for one case only: the person ticked "Do not keep this analysis" and the server saved the analysis anyway/m);
    assert.match(text, /A box above the results says so and has a button "Delete the saved copy now" \(`components\/document\/DeleteSavedCopy\.tsx`\)\./);
    assert.match(text, /a click only opens a question, nothing is sent until the person clicks "Yes, delete it", and "Cancel" or the Escape key closes it\./);
    assert.match(text, /It uses the same call, `DELETE \/documents\/:id`, and the same steps \(`services\/deleteFlow\.ts`\)\./);
  });

  it("says that the button does not leave the page, and what the page drops afterwards", () => {
    const text = section("Deleting a saved analysis");
    assert.match(text, /^- This button does not leave the page\./m);
    assert.match(text, /the box says that the saved copy is gone and that the analysis stays on the page until the person leaves it/);
    assert.match(text, /the "Saved" time, the note that the server saved the analysis, and the ID and Saved lines of the text file \(`withoutSavedCopy` in `services\/api\.ts`\)/);
    assert.match(text, /The other notes of the server stay\./);
    assert.match(text, /the question stays open with "Try again" and "Cancel"/);
  });

  it("says how it is tested and what was not tried", () => {
    const text = section("Deleting a saved analysis");
    assert.match(text, /\(`tests\/delete-now\.test\.mjs`\)/);
    assert.match(text, /\(`services\/savedCopy\.test\.mjs`\)/);
    assert.match(text, /The box was run in Chromium against a stand-in for the server, without Next\.js and without the styles\. It was not tried with Next\.js, with the styles \(so not its layout or its printout\) or with an old server\./);
  });

  it("is named in the part about keeping an analysis, with the functions that find the copy", () => {
    const text = section("Keeping or not keeping an analysis");
    assert.match(text, /shows a box above the results with a button "Delete the saved copy now" \(see "Deleting a saved analysis"\)/);
    assert.match(text, /the person can also delete the saved analysis in the History list \(see `SAVED_ANYWAY_NOTE`, `savedAgainstChoice` and `withoutSavedCopy` in `services\/api\.ts`\)/);
  });

  it("says that a printout leaves the box out", () => {
    assert.match(readme, /The box above the results that deletes a saved copy of the upload page is left out too\./);
  });

  it("is named in the Tests paragraph and in the test script of package.json", () => {
    const paragraph = readme.slice(readme.lastIndexOf("Run `pnpm test`."));
    assert.match(paragraph, /`services\/savedCopy\.test\.mjs` tests how the page finds a copy that the server saved against the choice of the person, and what the page shows once the copy is deleted\./);
    assert.match(paragraph, /`tests\/delete-now\.test\.mjs` keeps the box that deletes that copy, its place on the upload page and the description in this README in line with each other\./);
    const named = pkg.scripts.test.split(" ");
    assert.ok(named.includes("services/savedCopy.test.mjs"));
    assert.ok(named.includes("tests/delete-now.test.mjs"));
  });
});
