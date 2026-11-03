import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks, because the Node test runner cannot run a .tsx file.
// They keep the safety and the accessibility rules of the question box from being undone by accident.
// The steps are tested in services/chatFlow.test.mjs, and the call to the server in services/api.test.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const { HISTORY_SENT, MAX_HISTORY_CONTENT, MAX_QUESTION_LENGTH } = await import("../services/chatFlow.ts");

const chat = read("../components/document/DocumentChat.tsx");
const page = read("../app/documents/[id]/page.tsx");
const readme = read("../README.md");

describe("question box (components/document/DocumentChat.tsx): sending a question", () => {
  it("is a client component, because it reacts to typing and clicks", () => {
    assert.match(chat, /^"use client";/);
  });

  it("asks the server in one place only, and takes the earlier messages from the steps module", () => {
    assert.equal(count(chat, /askDocumentQuestion\(/g), 1);
    assert.match(chat, /async function ask\(text: string\) \{[\s\S]*await settle\(\(\) =>\s*askDocumentQuestion\(documentId, question, historyToSend\(state\.messages\), controller\.signal\),?\s*\)/);
  });

  it("does nothing when a question is already running, or when the text is not a question", () => {
    assert.equal(count(chat, /state\.step === "asking" \|\| /g), 2);
    assert.match(chat, /async function ask\(text: string\) \{\s*\/\/[^\n]*\n\s*if \(state\.step === "asking" \|\| requestRef\.current !== null \|\| checkQuestion\(text\) !== null\) \{\s*return;\s*\}/);
    assert.match(chat, /async function submit\(event: FormEvent<HTMLFormElement>\) \{\s*event\.preventDefault\(\);\s*if \(state\.step === "asking" \|\| checkQuestion\(draft\) !== null\) \{\s*return;\s*\}/);
  });

  it("sends the trimmed question, and clears the box before the answer comes", () => {
    assert.match(chat, /const question = text\.trim\(\);\s*const controller = new AbortController\(\);\s*requestRef\.current = controller;\s*dispatch\(\{ type: "ask", question \}\);/);
    assert.match(chat, /const text = draft;\s*setDraft\(""\);\s*await ask\(text\);/);
  });

  it("switches the Send button off while a question runs or when the box is empty", () => {
    assert.match(chat, /const canSend = asking === false && draft\.trim\(\) !== "";/);
    assert.match(chat, /disabled=\{canSend === false\}/);
    assert.match(chat, /\{asking \? "Asking\.\.\." : "Send"\}/);
  });

  it("does not let the person type more than the server accepts", () => {
    assert.match(chat, /maxLength=\{MAX_QUESTION_LENGTH\}/);
    assert.equal(MAX_QUESTION_LENGTH, 1000);
  });

  it("gives every button the type button or submit, so that nothing submits the form by accident", () => {
    const buttons = count(chat, /<button\b/g);
    assert.equal(buttons, 5);
    assert.equal(count(chat, /type="button"/g), 4);
    assert.equal(count(chat, /type="submit"/g), 1);
  });

  it("does not send the greeting, the error text or any id: the history comes only from answered questions", () => {
    assert.doesNotMatch(chat, /welcome-msg/);
    assert.doesNotMatch(chat, /I've analyzed|I have analyzed/);
    assert.doesNotMatch(chat, /Sorry, I encountered an error/);
    assert.equal(count(chat, /historyToSend\(/g), 1);
  });
});

describe("question box: what the person sees", () => {
  it("puts the person's messages on the right and the answers on the left", () => {
    assert.match(chat, /className=\{`flex \$\{mine \? "justify-end" : "justify-start"\}`\}/);
    assert.match(chat, /rounded-br-none bg-blue-600 text-white/);
    assert.match(chat, /rounded-bl-none border border-slate-200 bg-slate-100 text-slate-800/);
  });

  it("gives each message its own key, the id from the steps", () => {
    assert.match(chat, /<MessageBubble key=\{message\.id\} role=\{message\.role\} content=\{message\.content\} \/>/);
  });

  it("shows the text of a message as plain text, never as HTML, with its line breaks", () => {
    assert.doesNotMatch(chat, /dangerouslySetInnerHTML/);
    assert.match(chat, /<p className=\{`max-w-\[85%\] whitespace-pre-wrap wrap-break-word /);
    assert.match(chat, /\{content\}/);
  });

  it("shows the hint while there is no message and no question is running, so that a failed first question leaves no blank box", () => {
    assert.match(chat, /\{state\.messages\.length === 0 && asking === false \? \(\s*<p className="text-sm text-slate-500">\s*No answers yet\./);
  });

  it("shows at most three lines of a long question that failed", () => {
    assert.match(chat, /<p className="mt-1 line-clamp-3 text-red-800">&ldquo;\{state\.question\}&rdquo;<\/p>/);
  });

  it("says where the answers come from, that they can be wrong, and that they are not legal advice", () => {
    assert.match(chat, /Answers come only from the saved summary, clauses and notes, not from the whole contract\./);
    assert.match(chat, /They can be wrong and are not legal advice\./);
    assert.match(chat, /Each question is sent to the server together with this saved analysis\./);
    assert.match(chat, /Your questions are not saved: reloading the page clears them\./);
  });

  it("does not call itself a lawyer", () => {
    assert.doesNotMatch(chat, /Legal Assistant/);
    assert.match(chat, /Ask about this analysis/);
  });

  it("shows the question and a waiting text while the server works, and says that it can take a minute", () => {
    assert.match(chat, /\{asking \? <MessageBubble role="user" content=\{state\.question\} \/> : null\}/);
    assert.match(chat, /Working on an answer\.\.\./);
    assert.match(chat, /A small model can take a minute or more\. Please keep this page open\./);
  });

  it("shows an error as an alert with the reason, the question, and the buttons Try again and Dismiss", () => {
    assert.match(chat, /\{state\.step === "failed" \? \(\s*<div role="alert"/);
    assert.match(chat, /Your question was not answered\./);
    assert.match(chat, /\{state\.message\}/);
    assert.match(chat, /&ldquo;\{state\.question\}&rdquo;/);
    assert.match(chat, /onClick=\{\(\) => ask\(state\.question\)\}/);
    assert.match(chat, /onClick=\{\(\) => dispatch\(\{ type: "dismiss" \}\)\}/);
  });

  it("does not store the error as a message of the conversation", () => {
    assert.doesNotMatch(chat, /role: "ai",\s*content: "Sorry/);
    assert.doesNotMatch(chat, /console\./);
  });

  it("uses no dialog of the browser", () => {
    assert.doesNotMatch(chat, /\balert\(/);
    assert.doesNotMatch(chat, /\bconfirm\(/);
    assert.doesNotMatch(chat, /\bprompt\(/);
  });

  it("gives the list a fixed height, so that the input does not move down and out of view when messages come", () => {
    assert.match(chat, /role="log" aria-label="Questions and answers" tabIndex=\{-1\} className="h-80 [^"]*overflow-y-auto/);
    assert.doesNotMatch(chat, /max-h-96|min-h-40/);
  });

  it("scrolls when a message comes and also when a question starts or fails, so that the waiting text is in view", () => {
    assert.match(chat, /\}, \[state\.messages\.length, state\.step\]\);/);
  });

  it("breaks long words in the error box too", () => {
    assert.match(chat, /<div role="alert" className="[^"]*wrap-break-word"/);
  });

  it("scrolls the box itself to the newest message, and never the whole page", () => {
    assert.match(chat, /list\.scrollTop = list\.scrollHeight;/);
    assert.doesNotMatch(chat, /scrollIntoView/);
  });

  it("has no dark mode colours, because the app is light only", () => {
    assert.doesNotMatch(chat, /dark:/);
  });

  it("lets the waiting text stand still when the system asks for less motion", () => {
    const animations = count(chat, /\banimate-(spin|pulse|bounce)\b/g);
    assert.ok(animations > 0, "no animation found, so this check no longer tests anything");
    assert.equal(count(chat, /motion-reduce:animate-none/g), animations);
  });

  it("does not use white text on a light grey button when the Send button is off", () => {
    assert.match(chat, /disabled:bg-slate-200 disabled:text-slate-600/);
  });

  it("keeps a long word inside the box", () => {
    assert.match(chat, /wrap-break-word/);
    assert.match(chat, /min-w-0 flex-1/);
  });
});

describe("question box: keyboard and screen readers", () => {
  it("labels the box and its input", () => {
    assert.match(chat, /<section aria-labelledby=\{headingId\}/);
    assert.match(chat, /<h2 id=\{headingId\}/);
    assert.match(chat, /<label htmlFor=\{inputId\} className="sr-only">/);
    assert.match(chat, /<input\s+id=\{inputId\}/);
  });

  it("is a log, so that a screen reader reads out each new message, and a message says who wrote it", () => {
    assert.match(chat, /role="log" aria-label="Questions and answers"/);
    assert.match(chat, /<span className="sr-only">\{mine \? "You: " : "Assistant: "\}<\/span>/);
  });

  it("sends with the Enter key because the input sits in a form", () => {
    assert.match(chat, /<form onSubmit=\{submit\}/);
  });

  it("keeps the focus where it is: the input stays on while the server works, and only a stop or a suggested question moves it (see tests/chat-stop.test.mjs and tests/suggested-questions.test.mjs)", () => {
    assert.doesNotMatch(chat, /disabled=\{asking\}/);
    assert.equal(count(chat, /\.focus\(\)/g), 2);
  });

  it("uses only the colours that have enough contrast on white or on their own background", () => {
    assert.doesNotMatch(chat, /text-gray-400|text-slate-400|text-slate-300/);
  });
});

describe("saved report page: the question box", () => {
  it("is still a server component that uses the box", () => {
    assert.doesNotMatch(page, /"use client"/);
    assert.match(page, /import DocumentChat from "@\/components\/document\/DocumentChat";/);
  });

  it("gives the box the id of the document, and starts again when the id changes", () => {
    assert.match(page, /<DocumentChat key=\{documentId\} documentId=\{documentId\} \/>/);
    assert.equal(count(page, /<DocumentChat\b/g), 1);
  });

  it("puts the box under the analysis, in its own column, where the link of the header jumps to", () => {
    assert.ok(page.indexOf("<AnalysisResults") < page.indexOf("<DocumentChat"));
    assert.match(page, /<div id="ask" className="mx-auto mt-8 w-full max-w-3xl scroll-mt-20 print:hidden">\s*<DocumentChat /);
    assert.match(page, /<a href="#ask" className="[^"]*">\s*Ask a question about this analysis &darr;\s*<\/a>/);
  });

  it("keeps the Delete button where it was: in the header, before the analysis", () => {
    assert.ok(page.indexOf("Document ID:") < page.indexOf("<DeleteDocumentButton"));
    assert.ok(page.indexOf("<DeleteDocumentButton") < page.indexOf("<AnalysisResults"));
  });

  it("is the only place with the box: the upload page, the results and the History page have none", () => {
    for (const path of ["../app/page.tsx", "../components/document/AnalysisResults.tsx", "../app/dashboard/page.tsx"]) {
      assert.doesNotMatch(read(path), /DocumentChat/, path);
    }
  });
});

describe("README: asking questions", () => {
  it("lists the endpoint, and no longer says that the server does not have it", () => {
    assert.match(readme, /^- `POST \/documents\/:id\/ask` - /m);
    assert.doesNotMatch(readme, /is not built on the server yet/);
    assert.match(readme, /^## Asking questions about a saved analysis$/m);
  });

  it("states the limits as the code has them", () => {
    assert.match(readme, new RegExp(`at most ${MAX_QUESTION_LENGTH} characters`));
    assert.match(readme, new RegExp(`the latest ${HISTORY_SENT} messages of the conversation, each cut to ${MAX_HISTORY_CONTENT} characters`));
  });

  it("says what is not saved, and that the answers can be wrong", () => {
    assert.match(readme, /Nothing is saved\./);
    assert.match(readme, /Answers can be wrong and are not legal advice\./);
    assert.match(readme, /both go to wherever that service runs/);
  });

  it("describes the errors and the buttons", () => {
    assert.match(readme, /"Try again" and "Dismiss"/);
    assert.match(readme, /never sent as an earlier message/);
    assert.match(readme, /The page never shows made-up answers\./);
  });
});
