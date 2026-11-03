import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// These tests are for stopping an analysis: the call to the server that takes a signal (services/api.ts), and the words of the notice
// that the upload page shows after a stop (services/analyzeFlow.ts). The page itself is checked by tests/analyze-stop.test.mjs.

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const {
  ANALYSIS_STOPPED_MESSAGE,
  ASK_STOPPED_MESSAGE,
  SAVED_ANYWAY_NOTE,
  analyzeDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
} = await import("./api.ts");
const { STOP_HINT, STOPPED_MAYBE_SAVED, STOPPED_NEXT, STOPPED_TITLE, stoppedNotice } = await import("./analyzeFlow.ts");

// Web classes that Node provides globally. They are read from globalThis so lint rules about undefined globals stay quiet.
const { AbortController, DOMException, File } = globalThis;

// These tests expect the default address of the server, so a setting NEXT_PUBLIC_API_URL in the terminal must not change them.
delete process.env.NEXT_PUBLIC_API_URL;

const realFetch = globalThis.fetch;
let calls = [];

const sampleAnalysis = {
  documentName: "NDA.pdf",
  executiveSummary: "Short summary.",
  clauses: [],
};

const pdf = () => new File(["hello"], "contract.pdf", { type: "application/pdf" });

// A fetch that answers at once.
function stubFetch(status, body) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options });
    return {
      status: status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    };
  };
}

// A fetch that never answers by itself. Like the real one, it ends with an AbortError when the signal that it was given is aborted.
function waitingFetch() {
  globalThis.fetch = (url, options) => {
    calls.push({ url: String(url), options: options });
    return new Promise((resolve, reject) => {
      const signal = options === undefined ? undefined : options.signal;
      const abort = () => reject(new DOMException("This operation was aborted", "AbortError"));
      if (signal !== undefined && signal.aborted) {
        abort();
      } else if (signal !== undefined) {
        signal.addEventListener("abort", abort);
      }
    });
  };
}

// Lets the call that was just started reach its fetch.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("analyzeDocument: stopping the request", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("hands the signal to the request", async () => {
    stubFetch(200, sampleAnalysis);
    const controller = new AbortController();
    await analyzeDocument(pdf(), { signal: controller.signal });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.signal, controller.signal);
  });

  it("sends no signal when none is given, and the request is the same as before", async () => {
    stubFetch(200, sampleAnalysis);
    await analyzeDocument(pdf());
    assert.equal(calls[0].options.signal, undefined);
    assert.equal(calls[0].url, "http://localhost:3001/analyze");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual([...calls[0].options.body.keys()], ["document"]);
  });

  it("ends with its own message when the signal is aborted while the server works", async () => {
    waitingFetch();
    const controller = new AbortController();
    const running = analyzeDocument(pdf(), { signal: controller.signal });
    await tick();
    assert.equal(calls.length, 1);
    controller.abort();
    await assert.rejects(running, { message: ANALYSIS_STOPPED_MESSAGE });
  });

  it("ends with its own message when the signal was aborted before the call", async () => {
    waitingFetch();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(analyzeDocument(pdf(), { signal: controller.signal }), { message: ANALYSIS_STOPPED_MESSAGE });
  });

  it("ends with its own message when the signal is aborted while the answer is being read", async () => {
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options: options });
      return {
        status: 200,
        ok: true,
        json: () =>
          new Promise((resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
          }),
      };
    };
    const controller = new AbortController();
    const running = analyzeDocument(pdf(), { signal: controller.signal });
    await tick();
    controller.abort();
    await assert.rejects(running, { message: ANALYSIS_STOPPED_MESSAGE });
  });

  it("tells no other reason once the signal is aborted, also when the server answers with an error at the same moment", async () => {
    const controller = new AbortController();
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), options: options });
      controller.abort();
      return {
        status: 504,
        ok: false,
        json: async () => ({ message: "The AI service did not answer in time." }),
      };
    };
    await assert.rejects(analyzeDocument(pdf(), { signal: controller.signal }), { message: ANALYSIS_STOPPED_MESSAGE });
  });

  it("tells no unreachable server when the stop is the reason that the request failed", async () => {
    waitingFetch();
    const controller = new AbortController();
    const running = analyzeDocument(pdf(), { signal: controller.signal });
    await tick();
    controller.abort();
    await assert.rejects(running, (error) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /Could not reach|server at|status/);
      return true;
    });
  });

  it("has a message that is its own, and says that the analysis was stopped before the server answered", () => {
    assert.equal(ANALYSIS_STOPPED_MESSAGE, "The analysis was stopped before the server answered.");
    assert.notEqual(ANALYSIS_STOPPED_MESSAGE, ASK_STOPPED_MESSAGE);
  });

  it("does not change the other errors when the signal is not aborted: a server that cannot be reached", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const controller = new AbortController();
    await assert.rejects(
      analyzeDocument(pdf(), { signal: controller.signal }),
      /Could not reach the server at http:\/\/localhost:3001/,
    );
  });

  it("does not change the other errors when the signal is not aborted: the messages of the server", async () => {
    const controller = new AbortController();

    stubFetch(504, { message: "The AI service did not answer in time." });
    await assert.rejects(analyzeDocument(pdf(), { signal: controller.signal }), { message: "The AI service did not answer in time." });

    stubFetch(413, {});
    await assert.rejects(analyzeDocument(pdf(), { signal: controller.signal }), { message: "The file is too large for the server. Please choose a smaller file." });

    stubFetch(500, { message: "Internal server error" });
    await assert.rejects(analyzeDocument(pdf(), { signal: controller.signal }), /status 500/);
  });

  it("returns the analysis when the signal is given and not aborted", async () => {
    stubFetch(200, sampleAnalysis);
    const controller = new AbortController();
    const result = await analyzeDocument(pdf(), { signal: controller.signal });
    assert.deepEqual(result, sampleAnalysis);
  });

  it("returns the analysis if the signal is aborted only after the analysis came in", async () => {
    stubFetch(200, sampleAnalysis);
    const controller = new AbortController();
    const result = await analyzeDocument(pdf(), { signal: controller.signal });
    controller.abort();
    assert.deepEqual(result, sampleAnalysis);
  });

  it("still sends the choice not to keep the analysis next to the signal", async () => {
    stubFetch(200, sampleAnalysis);
    const controller = new AbortController();
    await analyzeDocument(pdf(), { keep: false, signal: controller.signal });
    assert.deepEqual(calls[0].options.body.getAll("save"), ["false"]);
    assert.equal(calls[0].options.body.get("document").name, "contract.pdf");
    assert.equal(calls[0].options.signal, controller.signal);
  });

  it("still puts the note first for a server that saved the analysis anyway, when a signal is given", async () => {
    stubFetch(200, { ...sampleAnalysis, id: "6ff69752-c563-4095-b6d4-71a3a62a9221", savedAt: "2026-10-25T16:30:00.000Z" });
    const controller = new AbortController();
    const result = await analyzeDocument(pdf(), { keep: false, signal: controller.signal });
    assert.equal(result.notes[0], SAVED_ANYWAY_NOTE);
  });

  it("gives no other call to the server a signal, because only the question and the analysis can be stopped", async () => {
    stubFetch(200, { documents: [], total: 0, unreadable: 0 });
    await listDocuments();
    stubFetch(204, {});
    await deleteDocument("6ff69752-c563-4095-b6d4-71a3a62a9221");
    stubFetch(200, sampleAnalysis);
    await getDocumentById("6ff69752-c563-4095-b6d4-71a3a62a9221");
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.options.signal, undefined, call.url);
    }
  });
});

describe("stoppedNotice: the words after a stop", () => {
  it("has the title first and the next step second, whatever the choice was", () => {
    for (const askedToKeep of [true, false]) {
      const lines = stoppedNotice(askedToKeep);
      assert.equal(lines[0], STOPPED_TITLE);
      assert.equal(lines[1], STOPPED_NEXT);
    }
  });

  it("warns about a saved copy only when the person did not tick the box", () => {
    assert.deepEqual(stoppedNotice(true), [STOPPED_TITLE, STOPPED_NEXT, STOPPED_MAYBE_SAVED]);
    assert.deepEqual(stoppedNotice(false), [STOPPED_TITLE, STOPPED_NEXT]);
  });

  it("has these texts", () => {
    assert.equal(STOPPED_TITLE, "The analysis was stopped.");
    assert.equal(STOPPED_NEXT, 'Your file is still selected. Click "Analyze Document" to start again, or choose another file.');
    assert.equal(
      STOPPED_MAYBE_SAVED,
      "The server may still have saved a copy, for example if it was almost done. If so, you can delete it in the History list.",
    );
    assert.equal(STOP_HINT, "If you stop, the server is asked to cancel the analysis. Leaving this page does the same.");
  });

  it("gives lines that are plain text, not empty, without spaces at the ends, and different from each other (the page uses a line as its key)", () => {
    for (const askedToKeep of [true, false]) {
      const lines = stoppedNotice(askedToKeep);
      assert.equal(new Set(lines).size, lines.length);
      for (const line of lines) {
        assert.ok(line.length > 0 && line === line.trim(), line);
        assert.match(line, /^[\x20-\x7e]+$/, line);
        assert.doesNotMatch(line, /[<>&]/, line);
      }
    }
  });

  it("does not promise that nothing was saved, because the server may have been almost done, or may be an older version", () => {
    for (const askedToKeep of [true, false]) {
      assert.doesNotMatch(stoppedNotice(askedToKeep).join(" "), /nothing (is|was|has been) saved|not saved/i);
    }
    assert.doesNotMatch(STOP_HINT, /nothing (is|was|has been) saved|not saved/i);
  });

  it("names the button that starts again and the list where a saved copy can be deleted", () => {
    assert.match(STOPPED_NEXT, /"Analyze Document"/);
    assert.match(STOPPED_MAYBE_SAVED, /History list/);
  });

  it("says in the hint what a stop asks of the server, and that leaving the page does the same", () => {
    assert.match(STOP_HINT, /the server is asked to cancel the analysis/);
    assert.match(STOP_HINT, /Leaving this page does the same\./);
  });

  it("gives a new list each time, so that a change of one list cannot reach the next", () => {
    const first = stoppedNotice(true);
    first.push("changed");
    first[0] = "changed";
    assert.equal(stoppedNotice(true)[0], STOPPED_TITLE);
    assert.equal(stoppedNotice(true).length, 3);
  });
});
