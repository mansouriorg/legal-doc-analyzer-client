import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the safety rules of the Delete button from being undone by accident.
// The steps are tested in services/deleteFlow.test.mjs, and the call to the server in services/api.test.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const button = read("../components/document/DeleteDocumentButton.tsx");
const page = read("../app/documents/[id]/page.tsx");
const readme = read("../README.md");

describe("Delete button (components/document/DeleteDocumentButton.tsx): nothing is deleted by accident", () => {
  it("is a client component, because it reacts to clicks", () => {
    assert.match(button, /^"use client";/);
  });

  it("asks the server in one place only, and only after the person clicks the red button", () => {
    assert.equal(count(button, /deleteDocument\(/g), 1);
    assert.match(button, /async function confirmDelete\(\) \{[\s\S]*await deleteDocument\(documentId\)/);
    assert.equal(count(button, /onClick=\{confirmDelete\}/g), 1);
  });

  it("opens only the question when the first button is clicked", () => {
    assert.match(button, /onClick=\{\(\) => dispatch\(\{ type: "ask" \}\)\}/);
    assert.equal(count(button, /type: "ask"/g), 1);
  });

  it("does nothing when the red button is clicked while a request runs, or before the question", () => {
    assert.match(button, /if \(state\.step !== "confirming" && state\.step !== "failed"\) \{\s*return;\s*\}/);
    assert.match(button, /const busy = state\.step === "deleting" \|\| state\.step === "done";/);
    assert.equal(count(button, /disabled=\{busy\}/g), 2);
  });

  it("tells the person that deleting cannot be undone and that the original file is not changed", () => {
    assert.match(button, /This cannot be undone\./);
    assert.match(button, /Your original file is not changed\./);
    assert.match(button, /Delete this saved analysis\?/);
  });

  it("shows the name of the document as text, never as HTML", () => {
    assert.match(button, /&ldquo;\{documentName\}&rdquo;/);
    assert.doesNotMatch(button, /dangerouslySetInnerHTML/);
  });

  it("uses no dialog of the browser, which cannot be styled and blocks the page", () => {
    assert.doesNotMatch(button, /\bconfirm\(/);
    assert.doesNotMatch(button, /\balert\(/);
    assert.doesNotMatch(button, /\bprompt\(/);
  });

  it("gives every button the type button, so that it can never submit a form", () => {
    const buttons = count(button, /<button\b/g);
    assert.equal(buttons, 3);
    assert.equal(count(button, /type="button"/g), buttons);
  });
});

describe("Delete button: what happens after the answer of the server", () => {
  it("stays on the page and shows the error when the call fails, and goes on only after a success", () => {
    assert.match(
      button,
      /type: "failed",[\s\S]*?\}\);\s*return;\s*\}\s*dispatch\(\{ type: "succeeded", outcome \}\);\s*(?:\/\/[^\n]*\n\s*)+window\.location\.assign\(deletedPath\(outcome\)\);/,
    );
  });

  it("goes to the History page with a normal page load, so the list cannot show the deleted analysis", () => {
    assert.equal(count(button, /window\.location\.assign\(/g), 1);
    assert.doesNotMatch(button, /useRouter|router\./);
    assert.doesNotMatch(button, /location\.href\s*=/);
    assert.ok(existsSync(new URL("../app/dashboard/page.tsx", import.meta.url)), "the page that AFTER_DELETE_PATH points to is missing");
  });

  it("offers a link to the History page when the page change does not happen", () => {
    assert.match(button, /<Link href=\{AFTER_DELETE_PATH\}/);
    assert.match(button, /Go to the History page now/);
  });

  it("does not show the question again once the analysis is deleted, because it is no longer true", () => {
    assert.match(button, /\{state\.step === "done" \? null : \(\s*<p className="mt-1 wrap-break-word">/);
    assert.match(button, /className=\{state\.step === "done" \? "sr-only" : "font-semibold"\}/);
  });

  it("lets the person try again or give up after a failure", () => {
    assert.match(button, /\{confirmLabel\(state\)\}/);
    assert.match(button, /onClick=\{\(\) => dispatch\(\{ type: "cancel" \}\)\}/);
    assert.match(button, /The analysis was not deleted\./);
  });
});

describe("Delete button: keyboard and screen readers", () => {
  it("puts the focus on Cancel when the question opens, and back on the first button when it closes", () => {
    assert.match(button, /state\.step === "confirming" \|\| state\.step === "failed"\) \{\s*cancelRef\.current\?\.focus\(\);/);
    assert.match(button, /state\.step === "idle" && wasOpen\.current\) \{\s*triggerRef\.current\?\.focus\(\);/);
    assert.match(button, /ref=\{cancelRef\}/);
    assert.match(button, /ref=\{triggerRef\}/);
  });

  it("closes the question with the Escape key, but not while the request runs", () => {
    assert.match(button, /event\.key === "Escape" && \(state\.step === "confirming" \|\| state\.step === "failed"\)/);
    assert.match(button, /onKeyDown=\{closeWithEscape\}/);
  });

  it("names the question as a group, announces the progress politely and an error as an alert", () => {
    assert.match(button, /role="group"/);
    assert.match(button, /aria-labelledby=\{headingId\}/);
    assert.match(button, /<p id=\{headingId\}/);
    assert.match(button, /role="status" aria-live="polite"/);
    assert.match(button, /<p role="alert"/);
  });

  it("hides the icon from screen readers", () => {
    assert.match(button, /<svg className="w-4 h-4" aria-hidden="true"/);
  });

  it("has no dark mode colours, because the app is light only", () => {
    assert.doesNotMatch(button, /dark:/);
  });
});

describe("saved report page: the Delete button", () => {
  it("is still a server component that uses the button", () => {
    assert.doesNotMatch(page, /"use client"/);
    assert.match(page, /import DeleteDocumentButton from "@\/components\/document\/DeleteDocumentButton";/);
  });

  it("gives the button the id and the name of the document that is shown", () => {
    assert.match(page, /<DeleteDocumentButton documentId=\{documentId\} documentName=\{documentData\.documentName\} \/>/);
    assert.equal(count(page, /<DeleteDocumentButton\b/g), 1);
  });

  it("puts the button in the header, after the document id and before the analysis", () => {
    assert.ok(page.indexOf("Document ID:") < page.indexOf("<DeleteDocumentButton"));
    assert.ok(page.indexOf("<DeleteDocumentButton") < page.indexOf("<AnalysisResults"));
  });

  it("is the only place with the button: the upload page, the results and the History page have none", () => {
    for (const path of ["../app/page.tsx", "../components/document/AnalysisResults.tsx", "../app/dashboard/page.tsx"]) {
      assert.doesNotMatch(read(path), /DeleteDocumentButton/, path);
    }
  });
});

describe("README: deleting", () => {
  it("lists the endpoint and describes the button", () => {
    assert.match(readme, /^- `DELETE \/documents\/:id` - /m);
    assert.match(readme, /^## Deleting a saved analysis$/m);
    assert.match(readme, /Nothing is sent to the server until the person clicks "Yes, delete it"\./);
    assert.match(readme, /Deleting is for good\./);
  });

  it("no longer says that the History list has no Delete button (see tests/history-delete.test.mjs)", () => {
    assert.doesNotMatch(readme, /There is no Delete button in the History list yet\./);
  });
});
