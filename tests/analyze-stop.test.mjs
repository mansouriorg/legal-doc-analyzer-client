import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the button that stops the analysis on the upload page, the notice that follows a stop, and the rules that make it safe
// from being undone by accident, and they keep the README true to the code.
// The call to the server is tested in services/analyzeStop.test.mjs, and the words of the notice in the same file.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const page = read("../app/page.tsx");
const api = read("../services/api.ts");
const flow = read("../services/analyzeFlow.ts");
const loading = read("../components/ui/LoadingState.tsx");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

describe("upload page (app/page.tsx): the Stop button", () => {
  it("has one button that stops the analysis, inside the loading card, under the loading screen", () => {
    assert.equal(count(page, /Stop the analysis/g), 1);
    assert.equal(count(page, /onClick=\{stop\}/g), 1);
    assert.match(
      page,
      /\{isUploading \? \(\s*<div className="[^"]*">\s*<LoadingState \/>\s*\{\/\*[^\n]*\*\/\}\s*<button\s+type="button"\s+onClick=\{stop\}\s+className="[^"]*"\s*>\s*Stop the analysis\s*<\/button>\s*<p className="[^"]*">\{STOP_HINT\}<\/p>\s*<\/div>\s*\) : analysisData === null \? \(/,
    );
  });

  it("is not in the upload card, so that it cannot be clicked by mistake when the person wants to start", () => {
    assert.ok(page.indexOf("Stop the analysis") < page.indexOf("<UploadZone"), "the button is below the upload zone");
    assert.ok(page.indexOf("Stop the analysis") < page.indexOf("Analyze Document\n"), "the button is below the Analyze button");
  });

  it("is a button of the type button, with a size and colours that are easy to hit and to read", () => {
    assert.match(page, /<button\s+type="button"\s+onClick=\{stop\}\s+className="[^"]*\bpx-6 py-2\.5\b[^"]*\bfont-semibold text-slate-700\b[^"]*"/);
    assert.match(page, /onClick=\{stop\}\s+className="[^"]*\bbg-white\b[^"]*\bborder-slate-300\b/);
    assert.match(page, /<p className="mt-3 text-sm text-slate-600 text-center">\{STOP_HINT\}<\/p>/);
  });

  it("lays the loading card out as a column, so that the button is under the loading screen", () => {
    assert.match(page, /min-h-\[400px\] flex flex-col items-center justify-center">\s*<LoadingState \/>/);
  });

  it("leaves the loading screen itself alone: it has no button, and still asks the person to keep the page open", () => {
    assert.doesNotMatch(loading, /<button/);
    assert.match(loading, /Please keep this page open/);
  });

  it("takes the hint from the module of the words and has no text of its own for it", () => {
    assert.match(page, /import \{ STOP_HINT, stoppedNotice \} from "@\/services\/analyzeFlow";/);
    assert.doesNotMatch(page, /If you stop, the server is asked/);
    assert.match(flow, /export const STOP_HINT = "If you stop, the server is asked to cancel the analysis\. Leaving this page does the same\.";/);
  });
});

describe("upload page: the request can be stopped", () => {
  it("makes a new AbortController for each analysis, keeps it in a ref before the loading screen is shown, and passes its signal to the call", () => {
    assert.equal(count(page, /new AbortController\(\)/g), 1);
    assert.match(page, /const controller = new AbortController\(\);\s*requestRef\.current = controller;\s*setIsUploading\(true\);/);
    assert.equal(count(page, /controller\.signal/g), 1);
    assert.match(page, /await analyzeDocument\(file, \{ keep: doNotKeep === false, signal: controller\.signal \}\)/);
  });

  it("keeps the ref in a ref and not in a state, and starts with no request", () => {
    assert.match(page, /const requestRef = useRef<AbortController \| null>\(null\);/);
    assert.match(page, /import \{ useEffect, useRef, useState \} from "react";/);
  });

  it("does not start a second request while one runs, also when two clicks come in the same moment", () => {
    assert.match(page, /if \(file === null \|\| requestRef\.current !== null\) return;/);
  });

  it("ignores the result of a request that was stopped, or that belongs to a page that was left, before it stores the result", () => {
    assert.equal(count(page, /if \(requestRef\.current !== controller\) return;/g), 2);
    assert.match(
      page,
      /if \(requestRef\.current !== controller\) return;\s*\/\/[^\n]*\n\s*setAnalysisData\(result\);\s*setSavedCopyId\(savedAgainstChoice\(result, doNotKeep\)\);/,
    );
  });

  it("shows no error for the request that was stopped: the check is the first thing in the catch block", () => {
    assert.match(page, /\} catch \(error\) \{\s*\/\/[^\n]*\n\s*if \(requestRef\.current !== controller\) return;\s*console\.error\("Upload failed:", error\);/);
  });

  it("leaves the loading screen only for the request that is still the current one", () => {
    assert.match(page, /\} finally \{\s*if \(requestRef\.current === controller\) \{\s*requestRef\.current = null;\s*setIsUploading\(false\);\s*\}\s*\}/);
    assert.equal(count(page, /setIsUploading\(false\)/g), 2);
  });

  it("stops the running request: it clears the ref first, aborts the request, asks for the focus, and shows the notice", () => {
    assert.match(
      page,
      /const stop = \(\) => \{\s*const controller = requestRef\.current;\s*if \(controller === null\) return;\s*\/\/[^\n]*\n\s*requestRef\.current = null;\s*controller\.abort\(\);\s*focusStopped\.current = true;\s*setStopped\(true\);\s*setIsUploading\(false\);\s*\};/,
    );
    assert.equal(count(page, /setStopped\(true\)/g), 1);
  });

  it("stops the request when the page is left, and only then", () => {
    assert.match(page, /useEffect\(\(\) => \{\s*return \(\) => \{\s*requestRef\.current\?\.abort\(\);\s*requestRef\.current = null;\s*\};\s*\}, \[\]\);/);
    assert.equal(count(page, /\.abort\(\)/g), 2);
  });

  it("gives the Stop button no other way to run than a click: the stop is not started by an effect or a timer", () => {
    assert.equal(count(page, /setTimeout|setInterval/g), 0);
    assert.equal(count(page, /stop\(\)/g), 0);
  });
});

describe("upload page: the notice after a stop", () => {
  it("is shown only after a stop, between the error box and the buttons, with the words of the module", () => {
    assert.equal(count(page, /\{stopped \? \(/g), 1);
    assert.match(page, /const \[stopped, setStopped\] = useState\(false\);/);
    assert.match(page, /\{stoppedNotice\(doNotKeep === false\)\.map\(\(line, index\) => \(/);
    assert.ok(page.indexOf('role="alert"') < page.indexOf("{stopped ? ("), "the notice is above the error box");
    assert.ok(page.indexOf("{stopped ? (") < page.indexOf("{/* Action Buttons */}"), "the notice is below the buttons");
  });

  it("has no text of its own for the stop: the words come from the module", () => {
    assert.doesNotMatch(page, /The analysis was stopped/);
    assert.doesNotMatch(page, /Your file is still selected/);
    assert.match(flow, /export const STOPPED_TITLE = "The analysis was stopped\.";/);
    assert.match(flow, /return askedToKeep \? \[STOPPED_TITLE, STOPPED_NEXT, STOPPED_MAYBE_SAVED\] : \[STOPPED_TITLE, STOPPED_NEXT\];/);
  });

  it("warns about a saved copy from the choice of the person: the same test as for the request, doNotKeep === false", () => {
    assert.equal(count(page, /doNotKeep === false/g), 2);
  });

  it("is a status, not an alert, because the person did this on purpose, and it is not red", () => {
    assert.equal(count(page, /role="alert"/g), 1);
    const start = page.indexOf("{stopped ? (");
    const notice = page.slice(start, page.indexOf(") : null}", start));
    assert.match(notice, /role="status"/);
    assert.doesNotMatch(notice, /red-|role="alert"/);
    assert.match(notice, /border-slate-300 bg-slate-100/);
  });

  it("can take the focus, and gets it after a stop", () => {
    assert.match(page, /<div ref=\{stoppedRef\} role="status" tabIndex=\{-1\} className="/);
    assert.match(page, /const stoppedRef = useRef<HTMLDivElement>\(null\);/);
    assert.match(page, /if \(stopped && focusStopped\.current\) \{\s*stoppedRef\.current\?\.focus\(\);\s*\}\s*focusStopped\.current = false;\s*\}, \[stopped\]\);/);
    assert.equal(count(page, /focusStopped\.current = true/g), 1);
    assert.equal(count(page, /\.focus\(\)/g), 1);
  });

  it("is cleared when an analysis starts, when another file is chosen, and when the person goes back from the results", () => {
    assert.equal(count(page, /setStopped\(false\)/g), 3);
    assert.match(page, /setErrorMessage\(null\);\s*setStopped\(false\);\s*try \{/);
    assert.match(page, /setAnalysisData\(null\); \/\/ Reset analysis if they drop a new file\s*setErrorMessage\(null\);\s*setStopped\(false\);/);
    const start = page.indexOf("onReset={() => {");
    assert.ok(start > -1, "onReset was not found");
    const reset = page.slice(start, page.indexOf("}}", start));
    assert.match(reset, /setFile\(null\);\s*setErrorMessage\(null\);\s*setStopped\(false\);/);
  });

  it("keeps the file and the choice: a stop does not clear them", () => {
    const start = page.indexOf("const stop = () => {");
    const body = page.slice(start, page.indexOf("};", start));
    assert.doesNotMatch(body, /setFile|setDoNotKeep|setAnalysisData|setSavedCopyId|setErrorMessage/);
  });

  it("offers the demo example only after an error, not after a stop", () => {
    assert.equal(count(page, /Show a demo example/g), 1);
    assert.match(page, /\{errorMessage !== null \? \(\s*<button\s+onClick=\{\(\) => \{\s*setAnalysisData\(getDemoAnalysis\(\)\);/);
  });

  it("uses only the colours that have enough contrast on white, and no dark mode colours", () => {
    assert.doesNotMatch(page, /text-gray-400|text-slate-400|text-slate-300/);
    assert.doesNotMatch(page, /dark:/);
  });
});

describe("services/api.ts: the call that can be stopped", () => {
  it("has one message for a stop, and a signal in the options", () => {
    assert.match(api, /export const ANALYSIS_STOPPED_MESSAGE = "The analysis was stopped before the server answered\.";/);
    assert.match(api, /keep\?: boolean;\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*signal\?: AbortSignal;\s*\}/);
  });

  it("replaces every error with that message once the signal is aborted, and changes nothing otherwise", () => {
    assert.match(
      api,
      /export async function analyzeDocument\(file: File, options: AnalyzeOptions = \{\}\): Promise<DocumentAnalysis> \{\s*try \{\s*return await sendDocument\(file, options\);\s*\} catch \(error\) \{\s*if \(options\.signal\?\.aborted === true\) \{\s*throw new Error\(ANALYSIS_STOPPED_MESSAGE\);\s*\}\s*throw error;\s*\}\s*\}/,
    );
  });

  it("does the work in a function that is not exported, and passes the signal on to the request", () => {
    assert.match(api, /\nasync function sendDocument\(file: File, options: AnalyzeOptions\): Promise<DocumentAnalysis> \{/);
    assert.equal(count(api, /export async function analyzeDocument/g), 1);
    assert.equal(count(api, /export async function sendDocument|export function sendDocument/g), 0);
    assert.match(api, /response = await fetch\(`\$\{baseUrl\}\/analyze`, \{\s*method: "POST",\s*body: formData,\s*signal: options\.signal,\s*\}\);/);
  });

  it("gives only two calls a signal: the analysis and the question", () => {
    assert.equal(count(api, /^\s*signal: options\.signal,$/gm), 1);
    assert.equal(count(api, /^\s*signal,$/gm), 1);
  });

  it("tells the people who read the code what a stop does on the server", () => {
    assert.ok(api.includes('A server whose README has the section "Stopping an analysis" then drops its own call to the AI service too'));
    assert.ok(api.includes("An older server keeps working on the analysis until the AI service answers or gives up, and saves it."));
  });
});

describe("the words of the stop (services/analyzeFlow.ts)", () => {
  it("names the button that starts again as the page has it", () => {
    assert.ok(page.includes("Analyze Document\n"), "the page no longer has this button");
    assert.match(flow, /Click "Analyze Document" to start again/);
  });

  it("has no import, so that the tests and the page read the same file without a build", () => {
    assert.equal(count(flow, /^import /gm), 0);
  });

  it("has no character that is not plain text", () => {
    for (const character of flow) {
      assert.ok(character === "\n" || (character >= " " && character <= "~"), JSON.stringify(character));
    }
  });
});

describe("README: stopping an analysis", () => {
  const start = readme.indexOf("## Stopping an analysis");
  const end = readme.indexOf("## History page");
  const section = readme.slice(start, end);

  it("has the section once, between Other screens and History page", () => {
    assert.equal(count(readme, /^## Stopping an analysis$/gm), 1);
    assert.ok(start > readme.indexOf("## Other screens") && end > start, "the section is missing or in the wrong place");
  });

  it("names the button and the hint as the page has them", () => {
    assert.ok(page.includes("Stop the analysis"));
    assert.ok(section.includes('a button "Stop the analysis" (`app/page.tsx`)'));
    assert.ok(section.includes('the hint "If you stop, the server is asked to cancel the analysis. Leaving this page does the same."'));
  });

  it("says what a click does: the call ends with its message, the file stays, a notice, the focus, no red box, no demo button", () => {
    assert.match(section, /`analyzeDocument` takes an optional `signal` in its options/);
    assert.match(section, /the only error it throws is `ANALYSIS_STOPPED_MESSAGE`/);
    assert.match(section, /with the file still selected and shows a notice, "The analysis was stopped\."/);
    assert.match(section, /the focus moves to the notice/);
    assert.match(section, /no red box and no "Show a demo example" button/);
    assert.match(section, /An answer that comes in later is never shown\./);
  });

  it("says that leaving the page stops the analysis too, and that this changes what happened before", () => {
    assert.match(section, /Leaving the page, for example with a click on "Document History" in the navigation bar, stops the analysis in the same way\./);
    assert.match(section, /Before this change that click did not stop the request, so the server could finish the analysis and save it\./);
  });

  it("says that a saved copy can exist after a stop, and why", () => {
    assert.match(section, /If the AI service had already answered, the analysis is saved as usual, and an older server finishes the analysis and saves it in any case\./);
    assert.match(section, /So a saved copy can exist after a stop\./);
    assert.match(section, /names the History list, where the copy can be deleted/);
  });

  it("says what was not tried", () => {
    assert.match(section, /That was not tried for an analysis, and not with this button\./);
    assert.match(section, /run in Chromium against a stand-in for the server, without Next\.js and without the styles/);
    assert.match(section, /It was not tried with Next\.js, with the styles \(so not the layout of the button or of the notice\), with a real server or with a real model\./);
  });

  it("is named in the places that describe the start page, the loading screen, the live test and the tests", () => {
    assert.match(readme, /the page shows a loading screen with a button "Stop the analysis" \(see "Stopping an analysis" below\)/);
    assert.match(readme, /The button that stops the analysis is under it \(see "Stopping an analysis"\)\./);
    assert.match(readme, /The stop of an analysis was not tried with a real model at all \(see "Stopping an analysis"\)\./);
    assert.match(readme, /`services\/analyzeStop\.test\.mjs` tests how the call to the server ends when the analysis is stopped/);
    assert.match(readme, /`tests\/analyze-stop\.test\.mjs` keeps the button that stops the analysis/);
  });
});

describe("the test script (package.json)", () => {
  it("runs the two files of the stop", () => {
    const named = pkg.scripts.test.split(" ");
    assert.ok(named.includes("services/analyzeStop.test.mjs"));
    assert.ok(named.includes("tests/analyze-stop.test.mjs"));
  });
});
