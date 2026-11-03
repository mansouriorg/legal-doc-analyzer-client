import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the safety rules of the Delete button in the History list from being undone by accident.
// The steps and the texts are tested in services/deleteFlow.test.mjs, and the call to the server in services/api.test.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const row = read("../components/document/HistoryRowActions.tsx");
const page = read("../app/dashboard/page.tsx");
const detail = read("../components/document/DeleteDocumentButton.tsx");
const readme = read("../README.md");

describe("History row actions (components/document/HistoryRowActions.tsx): nothing is deleted by accident", () => {
  it("is a client component, because it reacts to clicks", () => {
    assert.match(row, /^"use client";/);
  });

  it("asks the server in one place only, and only after the person clicks the red button", () => {
    assert.equal(count(row, /deleteDocument\(/g), 1);
    assert.match(row, /async function confirmDelete\(\) \{[\s\S]*await deleteDocument\(documentId\)/);
    assert.equal(count(row, /onClick=\{confirmDelete\}/g), 1);
  });

  it("opens only the question when the Delete button is clicked", () => {
    assert.match(row, /onClick=\{\(\) => dispatch\(\{ type: "ask" \}\)\}/);
    assert.equal(count(row, /type: "ask"/g), 1);
  });

  it("does nothing when the red button is clicked while a request runs, or before the question", () => {
    assert.match(row, /if \(state\.step !== "confirming" && state\.step !== "failed"\) \{\s*return;\s*\}/);
    assert.match(row, /const busy = state\.step === "deleting" \|\| state\.step === "done";/);
    assert.equal(count(row, /disabled=\{busy\}/g), 2);
  });

  it("tells the person that deleting cannot be undone and that the original file is not changed", () => {
    assert.match(row, /This cannot be undone\./);
    assert.match(row, /Your original file is not changed\./);
    assert.match(row, /Delete &ldquo;\{documentName\}&rdquo;\?/);
  });

  it("shows the name of the document as text, never as HTML", () => {
    assert.doesNotMatch(row, /dangerouslySetInnerHTML/);
    assert.equal(count(row, /\{documentName\}/g), 2);
  });

  it("uses no dialog of the browser, which cannot be styled and blocks the page", () => {
    assert.doesNotMatch(row, /\bconfirm\(/);
    assert.doesNotMatch(row, /\balert\(/);
    assert.doesNotMatch(row, /\bprompt\(/);
  });

  it("gives every button the type button, so that it can never submit a form", () => {
    const buttons = count(row, /<button\b/g);
    assert.equal(buttons, 3);
    assert.equal(count(row, /type="button"/g), buttons);
  });

  it("gives the Delete button the name of its document for screen readers, so the buttons do not all sound the same", () => {
    assert.match(row, /Delete<span className="sr-only"> the saved analysis of \{documentName\}<\/span>/);
  });
});

describe("History row actions: what happens after the answer of the server", () => {
  it("stays on the page and shows the error when the call fails, and goes on only after a success", () => {
    assert.match(
      row,
      /type: "failed",[\s\S]*?\}\);\s*return;\s*\}\s*dispatch\(\{ type: "succeeded", outcome \}\);\s*(?:\/\/[^\n]*\n\s*)+window\.location\.assign\(deletedPath\(outcome\)\);/,
    );
  });

  it("loads the History page again with a normal page load, so the list cannot show the deleted analysis", () => {
    assert.equal(count(row, /window\.location\.assign\(/g), 1);
    assert.doesNotMatch(row, /useRouter|router\./);
    assert.doesNotMatch(row, /location\.href\s*=/);
    assert.doesNotMatch(row, /location\.reload/);
  });

  it("offers a link to load the list again when the page change does not happen", () => {
    assert.match(row, /<Link href=\{deletedPath\(state\.outcome\)\}/);
    assert.match(row, /Reload the list now/);
  });

  it("does not show the question again once the analysis is deleted, because it is no longer true", () => {
    assert.match(row, /\{state\.step === "done" \? null : \(\s*<p className="mt-1">/);
    assert.match(row, /className=\{state\.step === "done" \? "sr-only" : "font-semibold wrap-anywhere"\}/);
  });

  it("shows the reason that the call gave, and a fixed text only when there is none", () => {
    assert.match(row, /const NOT_DELETED_TEXT = "The server did not delete the analysis\.";/);
    assert.match(row, /message: error instanceof Error && error\.message !== "" \? error\.message : NOT_DELETED_TEXT,/);
  });

  it("lets a long reason wrap inside the question", () => {
    assert.match(row, /<p role="alert" className="[^"]*wrap-break-word">/);
  });

  it("shows only the status and the link once the analysis is deleted, with no buttons", () => {
    assert.match(row, /\{state\.step === "done" \? null : \(\s*<div className="mt-3 flex flex-wrap gap-2">/);
    assert.match(row, /\{state\.step === "done" \? \(\s*<p className="mt-2">\s*<Link/);
  });

  it("lets the person try again or give up after a failure", () => {
    assert.match(row, /\{confirmLabel\(state\)\}/);
    assert.match(row, /onClick=\{\(\) => dispatch\(\{ type: "cancel" \}\)\}/);
    assert.match(row, /The analysis was not deleted\./);
  });
});

describe("History row actions: keyboard, screen readers and layout", () => {
  it("puts the focus on Cancel when the question opens, and back on the Delete button when it closes", () => {
    assert.match(row, /state\.step === "confirming" \|\| state\.step === "failed"\) \{\s*cancelRef\.current\?\.focus\(\);/);
    assert.match(row, /state\.step === "idle" && wasOpen\.current\) \{\s*triggerRef\.current\?\.focus\(\);/);
    assert.match(row, /ref=\{cancelRef\}/);
    assert.match(row, /ref=\{triggerRef\}/);
  });

  it("closes the question with the Escape key, but not while the request runs", () => {
    assert.match(row, /event\.key === "Escape" && \(state\.step === "confirming" \|\| state\.step === "failed"\)/);
    assert.equal(count(row, /onKeyDown=\{closeWithEscape\}/g), 2);
  });

  it("lets a click on the text of the question keep the Escape key working, because the question can take the focus", () => {
    assert.match(row, /tabIndex=\{-1\}/);
  });

  it("names the question as a group, announces the progress politely and an error as an alert", () => {
    assert.match(row, /role="group"/);
    assert.match(row, /aria-labelledby=\{headingId\}/);
    assert.match(row, /<p id=\{headingId\}/);
    assert.match(row, /role="status" aria-live="polite"/);
    assert.match(row, /<p role="alert"/);
  });

  it("keeps the line with the link and the Delete button the same while the question is open, so nothing moves under the mouse", () => {
    assert.equal(count(row, /\{children\}/g), 1);
    assert.match(row, /children: ReactNode;/);
    assert.match(row, /const open = state\.step !== "idle";/);
    assert.match(row, /aria-expanded=\{open\}/);
    assert.match(row, /\{open \? \(\s*<div\s+role="group"/);
    assert.ok(row.indexOf("{children}") < row.indexOf("{open ? ("));
    assert.doesNotMatch(row, /if \(state\.step === "idle"\) \{\s*return/);
  });

  it("does not take over the right alignment and the no-wrap of the table cell for the question", () => {
    assert.match(row, /className="w-72 max-w-full [^"]*text-left[^"]*whitespace-normal[^"]*"/);
  });

  it("never wraps the link and the Delete button in the table cell, because a table can make a wrapping cell too narrow", () => {
    assert.match(row, /align === "end" \? "flex items-center justify-end gap-x-4" :/);
  });

  it("lines the row up at the start in the cards and at the end in the table cell", () => {
    assert.match(row, /align: "start" \| "end";/);
    assert.match(row, /"flex items-center justify-end gap-x-4" : "flex flex-wrap items-center gap-x-4 gap-y-2"/);
    assert.match(row, /"flex flex-col items-end gap-3" : "flex flex-col items-start gap-3"/);
  });

  it("lets a long file name wrap in the question", () => {
    assert.match(row, /"font-semibold wrap-anywhere"/);
  });

  it("has no dark mode colours, because the app is light only", () => {
    assert.doesNotMatch(row, /dark:/);
  });
});

describe("History page (app/dashboard/page.tsx): Delete in every row", () => {
  it("is still a server component that has no button of its own", () => {
    assert.doesNotMatch(page, /"use client"/);
    assert.doesNotMatch(page, /<button/);
    assert.match(page, /import HistoryRowActions from "@\/components\/document\/HistoryRowActions";/);
  });

  it("puts the link to the report and the Delete button together in the cards and in the table", () => {
    assert.equal(count(page, /<HistoryRowActions\b/g), 2);
    assert.match(page, /<HistoryRowActions documentId=\{doc\.id\} documentName=\{doc\.documentName\} align="start">\s*<ReportLink doc=\{doc\} \/>\s*<\/HistoryRowActions>/);
    assert.match(page, /<td className="py-4 px-6 text-right whitespace-nowrap">\s*<HistoryRowActions documentId=\{doc\.id\} documentName=\{doc\.documentName\} align="end">\s*<ReportLink doc=\{doc\} \/>\s*<\/HistoryRowActions>\s*<\/td>/);
  });

  it("is the only page with these row buttons, and the saved report page keeps its own Delete button", () => {
    for (const path of ["../app/page.tsx", "../components/document/AnalysisResults.tsx", "../app/documents/[id]/page.tsx"]) {
      assert.doesNotMatch(read(path), /HistoryRowActions/, path);
    }
    assert.match(read("../app/documents/[id]/page.tsx"), /<DeleteDocumentButton\b/);
  });
});

describe("History page: the note after a deletion", () => {
  it("reads the address through searchParams, which Next.js gives as a promise, and only through readDeletedOutcome", () => {
    assert.match(page, /searchParams: Promise<Record<string, string \| string\[\] \| undefined>>;/);
    assert.match(page, /export default async function Dashboard\(\{ searchParams \}: DashboardProps\) \{\s*const params = await searchParams;\s*const deleted = readDeletedOutcome\(params\[DELETED_PARAM\]\);/);
    assert.match(page, /import \{ AFTER_DELETE_PATH, DELETED_PARAM, deletedNoteText, readDeletedOutcome \} from "@\/services\/deleteFlow";/);
  });

  it("shows a fixed text and never a text taken from the address", () => {
    assert.match(page, /\{deletedNoteText\(outcome\)\}/);
    // The address is used three times: it is read, then the note after a deletion is taken from it, then the search (see tests/history-filter.test.mjs).
    assert.equal(count(page, /\bparams\b/g), 3);
    assert.doesNotMatch(page, /searchParams\.|searchParams\[/);
    assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  });

  it("shows the note only for a known outcome, and also when the list cannot be loaded", () => {
    assert.match(page, /\{deleted === null \? null : <DeletedNote outcome=\{deleted\} \/>\}/);
    assert.ok(page.indexOf("<DeletedNote outcome={deleted} />") < page.indexOf("{stats === null ? ("));
  });

  it("puts the note under the title and above the three numbers", () => {
    assert.ok(page.indexOf("Upload New Document") < page.indexOf("<DeletedNote outcome={deleted} />"));
    assert.ok(page.indexOf("<DeletedNote outcome={deleted} />") < page.indexOf("<StatCards stats={stats} />"));
  });

  it("is a status message with a link that dismisses it, by opening the History page without the note", () => {
    assert.match(page, /<div\s+role="status"\s+className="mb-6 [^"]*border-emerald-300 bg-emerald-50 [^"]*text-emerald-900"/);
    assert.match(page, /<Link href=\{AFTER_DELETE_PATH\} className="[^"]*">\s*Dismiss\s*<\/Link>/);
  });

  it("uses light colours only", () => {
    assert.doesNotMatch(page, /dark:/);
  });
});

describe("the two Delete buttons agree", () => {
  it("both open the History page with the note after a success", () => {
    assert.match(detail, /window\.location\.assign\(deletedPath\(outcome\)\);/);
    assert.match(row, /window\.location\.assign\(deletedPath\(outcome\)\);/);
    assert.ok(existsSync(new URL("../app/dashboard/page.tsx", import.meta.url)), "the page that the address points to is missing");
  });

  it("both ask the server with the same call and the same steps", () => {
    for (const source of [detail, row]) {
      assert.match(source, /import \{ deleteDocument \} from "@\/services\/api";/);
      assert.match(source, /useReducer\(nextDeleteState, START_STATE\)/);
    }
  });
});

describe("README: Delete in the History list", () => {
  it("no longer says that the History list has no Delete button", () => {
    assert.doesNotMatch(readme, /There is no Delete button in the History list yet\./);
  });

  it("describes the row buttons and the note", () => {
    assert.match(readme, /^- Each row also has a Delete button \(`components\/document\/HistoryRowActions\.tsx`\)\./m);
    assert.match(readme, /^- Each row of the History page \(`\/dashboard`\) has a Delete button too/m);
    assert.match(readme, /`\/dashboard\?deleted=deleted`/);
    assert.match(readme, /`\/dashboard\?deleted=already-gone`/);
    assert.match(readme, /never shows other text from the address/);
    assert.match(readme, /"Dismiss" removes it\./);
  });

  it("says that the buttons of the list and of the saved page both use DELETE /documents/:id", () => {
    assert.match(readme, /The Delete button of the saved report page and the Delete button of each row of the History page use it/);
  });
});
