import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the Stop button of the question box, and the rules that make it safe, from being undone by accident.
// The steps are tested in services/chatFlow.test.mjs, and the call to the server in services/api.test.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const { STOPPED_TEXT } = await import("../services/chatFlow.ts");

const chat = read("../components/document/DocumentChat.tsx");
const flow = read("../services/chatFlow.ts");
const api = read("../services/api.ts");
const readme = read("../README.md");

describe("question box (components/document/DocumentChat.tsx): the Stop waiting button", () => {
  it("has one button that stops the question, inside the waiting text, which is in the page only while a question runs", () => {
    assert.equal(count(chat, /Stop waiting/g), 1);
    assert.equal(count(chat, /onClick=\{stop\}/g), 1);
    assert.match(
      chat,
      /\{asking \? \(\s*<div className="flex justify-start">\s*<p [^>]*>[\s\S]*?<button\s+type="button"\s+onClick=\{stop\}[\s\S]*?>\s*Stop waiting\s*<\/button>\s*<\/p>\s*<\/div>\s*\) : null\}/,
    );
  });

  it("keeps the Stop button away from the Send button, so that a double click on Send cannot stop the question", () => {
    assert.ok(chat.indexOf("Stop waiting") < chat.indexOf("<form"), "the Stop button must not be in the form");
    assert.match(chat, /\{asking \? "Asking\.\.\." : "Send"\}/);
    assert.doesNotMatch(chat, /asking \? [^\n]*Stop/);
  });

  it("is a button of the type button, with a size and colours that are easy to hit and to read", () => {
    assert.match(chat, /<button\s+type="button"\s+onClick=\{stop\}\s+className="[^"]*\bpx-3 py-1\.5 text-sm font-semibold text-slate-700\b[^"]*"/);
    assert.match(chat, /onClick=\{stop\}\s+className="[^"]*\bborder-slate-300\b[^"]*\bbg-white\b/);
  });

  it("stops the running request: it clears the ref first, aborts the request, asks for the focus, and tells the steps", () => {
    assert.match(
      chat,
      /function stop\(\) \{\s*const controller = requestRef\.current;\s*if \(controller === null\) \{\s*return;\s*\}\s*\/\/[^\n]*\n\s*requestRef\.current = null;\s*controller\.abort\(\);\s*focusRetry\.current = true;\s*dispatch\(\{ type: "stopped" \}\);\s*\}/,
    );
  });

  it("has no text of its own for the stop: the text comes from the steps module", () => {
    assert.doesNotMatch(chat, /You stopped waiting/);
    assert.match(flow, /export const STOPPED_TEXT = "You stopped waiting for the answer\.";/);
    assert.equal(STOPPED_TEXT, "You stopped waiting for the answer.");
    assert.match(flow, /if \(action\.type === "stopped"\) \{\s*return \{ \.\.\.state, step: "failed", message: STOPPED_TEXT \};\s*\}/);
  });
});

describe("question box: the request can be stopped", () => {
  it("makes a new AbortController for each question and passes its signal to the call", () => {
    assert.equal(count(chat, /new AbortController\(\)/g), 1);
    assert.match(chat, /const controller = new AbortController\(\);\s*requestRef\.current = controller;\s*dispatch\(\{ type: "ask", question \}\);/);
    assert.equal(count(chat, /controller\.signal/g), 1);
  });

  it("ignores the result of a request that was stopped, or that belongs to a page that was left", () => {
    assert.match(chat, /if \(requestRef\.current !== controller\) \{\s*return;\s*\}\s*requestRef\.current = null;\s*dispatch\(action\);/);
  });

  it("does not start a second request while one runs, also when two clicks come in the same moment", () => {
    assert.match(chat, /if \(state\.step === "asking" \|\| requestRef\.current !== null \|\| checkQuestion\(text\) !== null\) \{\s*return;\s*\}/);
  });

  it("stops the request when the page is left or the document changes, and only then", () => {
    assert.match(chat, /useEffect\(\(\) => \{\s*return \(\) => \{\s*requestRef\.current\?\.abort\(\);\s*requestRef\.current = null;\s*\};\s*\}, \[\]\);/);
  });

  it("moves the focus to Try again after a stop, and otherwise only to the list of messages when a suggested question is asked", () => {
    assert.match(chat, /if \(state\.step === "failed" && focusRetry\.current\) \{\s*retryRef\.current\?\.focus\(\);\s*\}\s*focusRetry\.current = false;\s*\}, \[state\.step\]\);/);
    assert.match(chat, /<button\s+ref=\{retryRef\}\s+type="button"\s+onClick=\{\(\) => ask\(state\.question\)\}/);
    assert.equal(count(chat, /focusRetry\.current = true/g), 1);
    assert.equal(count(chat, /\.focus\(\)/g), 2);
  });

  it("passes the signal on to fetch, and has one message for a stop, in the module of the server calls", () => {
    assert.match(api, /export const ASK_STOPPED_MESSAGE = "The question was stopped before the server answered\.";/);
    assert.match(api, /cache: "no-store",\s*signal,\s*body: JSON\.stringify\(\{\s*question,/);
    assert.match(api, /try \{\s*return await sendQuestion\(documentId, question, history, signal\);\s*\} catch \(error\) \{\s*if \(signal\?\.aborted === true\) \{\s*throw new Error\(ASK_STOPPED_MESSAGE\);\s*\}\s*throw error;\s*\}/);
  });

  it("gives no other call a signal: only the question and the analysis can be stopped", () => {
    assert.equal(count(api, /^\s*signal,$/gm), 1);
    assert.equal(count(api, /^\s*signal: options\.signal,$/gm), 1);
  });
});

describe("question box: the seconds waited", () => {
  it("is drawn by a small component of its own, in the waiting text, between the waiting words and the hint", () => {
    assert.equal(count(chat, /<WaitedTime \/>/g), 1);
    assert.ok(chat.indexOf("Working on an answer...") < chat.indexOf("<WaitedTime />"));
    assert.ok(chat.indexOf("<WaitedTime />") < chat.indexOf("A small model can take a minute or more."));
    assert.match(chat, /\nfunction WaitedTime\(\) \{\s*const \[seconds, setSeconds\] = useState\(0\);/);
  });

  it("reads the clock each time, starts its timer in an effect, and clears it", () => {
    assert.match(
      chat,
      /useEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*const startedAt = Date\.now\(\);\s*const timer = window\.setInterval\(\(\) => setSeconds\(Math\.floor\(\(Date\.now\(\) - startedAt\) \/ 1000\)\), 1000\);\s*return \(\) => window\.clearInterval\(timer\);\s*\}, \[\]\);/,
    );
    assert.equal(count(chat, /Date\.now\(\)/g), 2);
    assert.equal(count(chat, /window\.setInterval\(/g), 1);
    assert.equal(count(chat, /window\.clearInterval\(/g), 1);
  });

  it("is hidden from screen readers, which would read out a new number every second", () => {
    assert.match(chat, /return <span aria-hidden="true"> \(\{formatWaited\(seconds\)\}\)<\/span>;/);
  });

  it("uses the text of formatWaited from the steps module", () => {
    assert.match(chat, /import \{[^}]*\bformatWaited\b[^}]*\} from "@\/services\/chatFlow";/);
    assert.match(flow, /export function formatWaited\(seconds: number\): string \{/);
  });

  it("does not move anything by itself: no animation, no scrolling for the counter", () => {
    assert.equal(count(chat, /\banimate-(spin|pulse|bounce)\b/g), 1);
    assert.doesNotMatch(chat, /scrollIntoView/);
  });
});

describe("question box: light colours only", () => {
  it("has no dark mode colours, because the app is light only", () => {
    assert.doesNotMatch(chat, /dark:/);
  });
});

describe("README: Stop waiting", () => {
  it("describes the button, the seconds and the red box that follows a stop", () => {
    assert.match(readme, /"Working on an answer\.\.\." with the seconds waited so far \(for example "\(12 s\)", and "\(1 min 5 s\)" from a minute on\), and a button "Stop waiting"/);
    assert.match(readme, /"Stop waiting" cancels the request of the browser/);
    assert.match(readme, /"You stopped waiting for the answer\.", "Try again" and "Dismiss"/);
    assert.match(readme, /the focus moves to "Try again"/);
    assert.match(readme, /an answer that comes later is never shown/);
  });

  it("says that leaving the page stops the waiting too", () => {
    assert.match(readme, /Leaving the page, or opening another document, stops the waiting in the same way\./);
  });

  it("says that the server cancels its own call to the AI service too, and what the live test with Ollama showed", () => {
    assert.match(readme, /^- Stopping also reaches the server\. When the browser drops the request, a server that has `src\/client-gone\.ts` cancels its own call to the AI service/m);
    assert.match(readme, /one that stops generating is free for the next question, one that does not goes on until it is done\./);
    assert.match(readme, /Ollama 0\.40\.13 with `qwen2\.5:7b` ended the question when the connection was closed\./);
    assert.doesNotMatch(readme, /That was not tried with a real Ollama model\./);
    assert.match(readme, /An older copy of the server keeps working on the question until the AI service answers or gives up \(`AI_TIMEOUT_SECONDS`\)\./);
  });

  it("no longer says that the server does not stop its own work, in the README or in the comment of the call", () => {
    assert.doesNotMatch(readme, /The server does not stop its own work/);
    assert.doesNotMatch(readme, /Stopping only ends the waiting in the browser/);
    assert.doesNotMatch(readme, /A new question asked meanwhile may have to wait for it\./);
    assert.doesNotMatch(api, /the server can keep working on the question until the AI service answers or gives up/);
    assert.match(api, /A server that has src\/client-gone\.ts then drops its own call to the AI service too\./);
    assert.match(api, /An older server keeps working on the question until the AI service answers or gives up\./);
  });

  it("no longer says that the person cannot stop earlier, and names the limit of the server", () => {
    assert.doesNotMatch(readme, /The page has no time limit of its own: it waits for the server/);
    assert.match(readme, /The page has no fixed time limit of its own: the server gives up on the AI service after `AI_TIMEOUT_SECONDS` \(120 seconds unless it is set otherwise\)/);
  });
});
