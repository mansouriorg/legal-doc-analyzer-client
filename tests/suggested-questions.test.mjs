import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks for the buttons of the suggested questions, because the Node test runner cannot run a .tsx file.
// The questions themselves are checked with the real functions of the steps module (services/chatFlow.ts).

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const { MAX_QUESTION_LENGTH, START_STATE, SUGGESTED_QUESTIONS, checkQuestion, nextChatState } = await import("../services/chatFlow.ts");

const chat = read("../components/document/DocumentChat.tsx");
const flow = read("../services/chatFlow.ts");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

describe("suggested questions (services/chatFlow.ts)", () => {
  it("are four to six texts, each one a question the box accepts", () => {
    assert.ok(Array.isArray(SUGGESTED_QUESTIONS));
    assert.ok(SUGGESTED_QUESTIONS.length >= 4 && SUGGESTED_QUESTIONS.length <= 6, "number of questions: " + SUGGESTED_QUESTIONS.length);
    for (const question of SUGGESTED_QUESTIONS) {
      assert.equal(typeof question, "string");
      assert.equal(checkQuestion(question), null, question);
      assert.ok(question.length <= 100, "too long for a button: " + question);
      assert.ok(question.length < MAX_QUESTION_LENGTH);
    }
  });

  it("have no spaces around them, no repeats, and only plain ASCII characters", () => {
    assert.equal(new Set(SUGGESTED_QUESTIONS).size, SUGGESTED_QUESTIONS.length);
    for (const question of SUGGESTED_QUESTIONS) {
      assert.equal(question, question.trim());
      assert.match(question, /^[\x20-\x7e]+$/, question);
      assert.match(question, /[?.]$/, question);
    }
  });

  it("start a question in the steps when the conversation is empty", () => {
    for (const question of SUGGESTED_QUESTIONS) {
      const next = nextChatState(START_STATE, { type: "ask", question });
      assert.equal(next.step, "asking");
      assert.equal(next.question, question);
      assert.deepEqual(next.messages, []);
    }
  });

  it("start a question also after a first question failed, and drop the failed one", () => {
    const asking = nextChatState(START_STATE, { type: "ask", question: "A question that fails." });
    const failed = nextChatState(asking, { type: "failed", message: "No." });
    assert.equal(failed.step, "failed");
    const next = nextChatState(failed, { type: "ask", question: SUGGESTED_QUESTIONS[0] });
    assert.equal(next.step, "asking");
    assert.equal(next.question, SUGGESTED_QUESTIONS[0]);
    assert.equal(next.message, "");
    assert.deepEqual(next.messages, []);
  });

  it("are a list that no one can change by accident: it is declared read only", () => {
    assert.match(flow, /export const SUGGESTED_QUESTIONS: readonly string\[\] = \[/);
  });
});

describe("question box (components/document/DocumentChat.tsx): the suggested questions", () => {
  it("takes the questions from the steps module and shows them as a list with a name", () => {
    assert.match(chat, /import \{[^}]*\bSUGGESTED_QUESTIONS\b[^}]*\} from "@\/services\/chatFlow";/);
    assert.match(chat, /<ul aria-label="Suggested questions" className="flex flex-col items-start gap-2">/);
    assert.equal(count(chat, /SUGGESTED_QUESTIONS\.map\(/g), 1);
  });

  it("shows them only while no question was answered and none runs, next to the hint", () => {
    assert.equal(count(chat, /\{state\.messages\.length === 0 && asking === false \? \(/g), 2);
    assert.match(chat, /\{state\.messages\.length === 0 && asking === false \? \(\s*<ul aria-label="Suggested questions"/);
  });

  it("makes one button for each question, of the type button, with the question as its text", () => {
    assert.match(
      chat,
      /\{SUGGESTED_QUESTIONS\.map\(\(question\) => \(\s*<li key=\{question\} className="max-w-full">\s*<button\s+type="button"\s+onClick=\{\(\) => askSuggested\(question\)\}[\s\S]*?>\s*\{question\}\s*<\/button>\s*<\/li>\s*\)\)\}/,
    );
  });

  it("asks a suggested question through the same function as a typed one", () => {
    assert.match(chat, /async function askSuggested\(question: string\) \{\s*listRef\.current\?\.focus\(\);\s*await ask\(question\);\s*\}/);
    assert.equal(count(chat, /askDocumentQuestion\(/g), 1);
    assert.equal(count(chat, /askSuggested\(/g), 2);
  });

  it("moves the focus to the list of messages, which can take the focus but is not in the tab order", () => {
    assert.match(chat, /<div ref=\{listRef\} role="log" aria-label="Questions and answers" tabIndex=\{-1\} className=/);
    assert.equal(count(chat, /\.focus\(\)/g), 2);
  });

  it("tells the person to type a question or to choose one", () => {
    assert.match(chat, /No answers yet\. Type a question below, or choose one of these:/);
    assert.doesNotMatch(chat, /For example, you can ask/);
  });

  it("uses colours that are easy to read, and no dark mode colours", () => {
    assert.match(chat, /border border-blue-200 bg-blue-50 px-3 py-1\.5 text-left text-sm font-medium text-blue-800/);
    assert.doesNotMatch(chat, /\bdark:/);
    assert.doesNotMatch(chat, /text-gray-400|text-slate-400|text-slate-300/);
  });
});

describe("README: the suggested questions", () => {
  it("lists the questions exactly as the code has them, and names where they are written", () => {
    assert.match(readme, /suggested questions as buttons \(`SUGGESTED_QUESTIONS` in `services\/chatFlow\.ts`\)/);
    for (const question of SUGGESTED_QUESTIONS) {
      assert.ok(readme.includes('"' + question + '"'), "the README does not list: " + question);
    }
    assert.match(readme, /shows four suggested questions/);
    assert.equal(SUGGESTED_QUESTIONS.length, 4);
  });

  it("says what a click does, and what the page adds to the question", () => {
    assert.match(readme, /A click asks that question at once, in the same way as typing it and pressing Send/);
    assert.match(readme, /the page adds nothing else/);
    assert.match(readme, /The focus moves to the list of messages/);
  });

  it("says when the buttons are shown and when they are gone", () => {
    assert.match(readme, /shown while no question has been answered and none is running, also next to the red box of a first question that failed/);
    assert.match(readme, /gone until the page is reloaded/);
  });

  it("says that the questions are fixed texts that may not fit every document", () => {
    assert.match(readme, /fixed texts, written to fit most contracts, so some may not fit a particular document/);
  });

  it("says what was not tried", () => {
    assert.match(readme, /The tests read the source text and do not open a browser, and the buttons were not tried with a real model\./);
  });

  it("is named in the Tests paragraph and in the test script of package.json", () => {
    assert.match(readme, /`tests\/suggested-questions\.test\.mjs` keeps the suggested questions/);
    assert.ok(pkg.scripts.test.split(" ").includes("tests/suggested-questions.test.mjs"));
  });
});
