import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// These tests cover the two small functions that the upload page uses for a copy that the server saved although the person
// ticked "Do not keep this analysis", and the texts of the box that deletes that copy.
// The box itself is checked in tests/delete-now.test.mjs. Node 22.18 or newer can import a .ts file directly (it strips the types).
const { SAVED_ANYWAY_NOTE, analyzeDocument, getDemoAnalysis, savedAgainstChoice, withoutSavedCopy } = await import("./api.ts");
const { copyDoneMessage, copyStatusText, statusText, doneMessage } = await import("./deleteFlow.ts");

const { File } = globalThis;

// The calls below go to the default address, and the address does not matter for these tests, but a wrong setting in the terminal would stop them.
delete process.env.NEXT_PUBLIC_API_URL;

const ID = "6ff69752-c563-4095-b6d4-71a3a62a9221";
const SAVED_AT = "2026-10-25T16:30:00.000Z";

function sample(extra = {}) {
  return {
    documentName: "NDA.pdf",
    executiveSummary: "Short summary.",
    clauses: [{ id: "c1", title: "Term", originalText: "Five years.", riskLevel: "Low", explanation: "Fixed term." }],
    ...extra,
  };
}

describe("savedAgainstChoice", () => {
  it("gives the id when the person asked not to keep the analysis and the analysis has an id", () => {
    assert.equal(savedAgainstChoice(sample({ id: ID, savedAt: SAVED_AT }), true), ID);
  });

  it("gives null when the person did not ask not to keep the analysis, also when there is an id", () => {
    assert.equal(savedAgainstChoice(sample({ id: ID }), false), null);
  });

  it("gives null when there is no usable id", () => {
    for (const id of [undefined, null, "", 0, 7, true, {}, [], ["a"]]) {
      assert.equal(savedAgainstChoice(sample({ id }), true), null, String(id));
    }
    assert.equal(savedAgainstChoice(sample(), true), null);
  });

  it("gives null for the built-in demo example, which has no id", () => {
    assert.equal(savedAgainstChoice(getDemoAnalysis(), true), null);
  });

  it("does not change the analysis it was given", () => {
    const analysis = sample({ id: ID, savedAt: SAVED_AT, notes: ["A note."] });
    const before = structuredClone(analysis);
    savedAgainstChoice(analysis, true);
    assert.deepEqual(analysis, before);
  });
});

describe("withoutSavedCopy", () => {
  it("drops the id and the time of saving, and keeps the summary, the clauses and the name", () => {
    const analysis = sample({ id: ID, savedAt: SAVED_AT, notes: [SAVED_ANYWAY_NOTE] });
    const result = withoutSavedCopy(analysis);
    assert.equal("id" in result, false);
    assert.equal("savedAt" in result, false);
    assert.equal(result.documentName, analysis.documentName);
    assert.equal(result.executiveSummary, analysis.executiveSummary);
    assert.deepEqual(result.clauses, analysis.clauses);
  });

  it("drops the note that says the server saved the analysis, and keeps the other notes in their order", () => {
    const analysis = sample({ id: ID, notes: [SAVED_ANYWAY_NOTE, "First note.", "Second note."] });
    assert.deepEqual(withoutSavedCopy(analysis).notes, ["First note.", "Second note."]);
  });

  it("drops the note wherever it stands in the list", () => {
    const analysis = sample({ id: ID, notes: ["First note.", SAVED_ANYWAY_NOTE, "Second note."] });
    assert.deepEqual(withoutSavedCopy(analysis).notes, ["First note.", "Second note."]);
  });

  it("gives an empty list of notes when that was the only note, or when there were none", () => {
    assert.deepEqual(withoutSavedCopy(sample({ id: ID, notes: [SAVED_ANYWAY_NOTE] })).notes, []);
    assert.deepEqual(withoutSavedCopy(sample({ id: ID })).notes, []);
  });

  it("keeps a note that only looks like the saved-anyway note", () => {
    const almost = SAVED_ANYWAY_NOTE + " Extra.";
    assert.deepEqual(withoutSavedCopy(sample({ id: ID, notes: [almost] })).notes, [almost]);
  });

  it("leaves out what is not a usable note, as the page does when it shows notes", () => {
    const analysis = sample({ id: ID, notes: [SAVED_ANYWAY_NOTE, 5, null, "", "  ", "Kept."] });
    assert.deepEqual(withoutSavedCopy(analysis).notes, ["Kept."]);
  });

  it("keeps the mark of a demo example as it is", () => {
    assert.equal(withoutSavedCopy(sample({ id: ID, isDemo: true })).isDemo, true);
    assert.equal("isDemo" in withoutSavedCopy(sample({ id: ID })), false);
  });

  it("does not change the analysis it was given, and gives a new object", () => {
    const analysis = sample({ id: ID, savedAt: SAVED_AT, notes: [SAVED_ANYWAY_NOTE, "Other."] });
    const before = structuredClone(analysis);
    const result = withoutSavedCopy(analysis);
    assert.deepEqual(analysis, before);
    assert.notEqual(result, analysis);
    assert.notEqual(result.notes, analysis.notes);
  });

  it("gives the same result when it is used twice", () => {
    const once = withoutSavedCopy(sample({ id: ID, savedAt: SAVED_AT, notes: [SAVED_ANYWAY_NOTE, "Other."] }));
    assert.deepEqual(withoutSavedCopy(once), once);
  });

  it("gives an analysis for which the page finds no saved copy any more", () => {
    const result = withoutSavedCopy(sample({ id: ID, savedAt: SAVED_AT, notes: [SAVED_ANYWAY_NOTE] }));
    assert.equal(savedAgainstChoice(result, true), null);
  });
});

describe("the page and the call agree about a copy that was saved against the choice", () => {
  const realFetch = globalThis.fetch;
  const pdf = () => new File(["hello"], "contract.pdf", { type: "application/pdf" });

  beforeEach(() => {
    globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => sample({ id: ID, savedAt: SAVED_AT }) });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("finds the copy when the person asked not to keep the analysis, and the call puts its note first", async () => {
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.equal(result.notes[0], SAVED_ANYWAY_NOTE);
    assert.equal(savedAgainstChoice(result, true), ID);
  });

  it("finds nothing when the person did not ask, and the call adds no note", async () => {
    for (const options of [{}, { keep: true }]) {
      const result = await analyzeDocument(pdf(), options);
      assert.equal(result.notes, undefined);
      assert.equal(savedAgainstChoice(result, options.keep === false), null);
    }
  });

  it("finds nothing when the server saved nothing, and the call adds no note", async () => {
    globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => sample() });
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.equal(result.notes, undefined);
    assert.equal(savedAgainstChoice(result, true), null);
  });

  it("has the note exactly when the page finds a copy, for every combination", async () => {
    for (const asked of [true, false]) {
      for (const id of [ID, undefined, ""]) {
        globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => sample({ id }) });
        const result = await analyzeDocument(pdf(), asked ? { keep: false } : {});
        const hasNote = Array.isArray(result.notes) && result.notes.includes(SAVED_ANYWAY_NOTE);
        assert.equal(hasNote, savedAgainstChoice(result, asked) !== null, "asked " + asked + ", id " + JSON.stringify(id));
      }
    }
  });

  it("gives back, after the copy is deleted, what the call gives for an analysis that was not saved", async () => {
    const saved = await analyzeDocument(pdf(), { keep: false });
    globalThis.fetch = async () => ({ status: 200, ok: true, json: async () => sample() });
    const notSaved = await analyzeDocument(pdf(), { keep: false });
    const after = withoutSavedCopy(saved);
    assert.equal(after.documentName, notSaved.documentName);
    assert.deepEqual(after.clauses, notSaved.clauses);
    assert.equal("id" in after, false);
    assert.equal("savedAt" in after, false);
    assert.deepEqual(after.notes, []);
  });
});

describe("the texts of the box that deletes the saved copy", () => {
  it("tell the two outcomes apart, and both say that the analysis stays on the page", () => {
    const deleted = copyDoneMessage("deleted");
    const gone = copyDoneMessage("already-gone");
    assert.notEqual(deleted, gone);
    for (const text of [deleted, gone]) {
      assert.match(text, /The analysis stays on this page until you leave it\./);
    }
    assert.match(deleted, /^Deleted\./);
    assert.match(gone, /already deleted/);
  });

  it("do not send the person to another page", () => {
    for (const outcome of ["deleted", "already-gone"]) {
      assert.doesNotMatch(copyDoneMessage(outcome), /History|Opening|Reloading/);
    }
  });

  it("say something to a screen reader only while deleting and when done", () => {
    assert.equal(copyStatusText({ step: "idle" }), "");
    assert.equal(copyStatusText({ step: "confirming" }), "");
    assert.equal(copyStatusText({ step: "failed", message: "x" }), "");
    assert.equal(copyStatusText({ step: "deleting" }), "Deleting the saved copy...");
    assert.equal(copyStatusText({ step: "done", outcome: "deleted" }), copyDoneMessage("deleted"));
    assert.equal(copyStatusText({ step: "done", outcome: "already-gone" }), copyDoneMessage("already-gone"));
  });

  it("do not repeat the message of a failure, which is shown as an alert", () => {
    assert.equal(copyStatusText({ step: "failed", message: "The server said no." }).includes("The server said no."), false);
  });

  it("differ from the texts of the Delete button of the saved report page, which opens the History page", () => {
    assert.notEqual(copyStatusText({ step: "deleting" }), statusText({ step: "deleting" }));
    assert.notEqual(copyDoneMessage("deleted"), doneMessage("deleted"));
    assert.match(doneMessage("deleted"), /Opening the History page/);
  });

  it("are plain ASCII text without markup", () => {
    for (const text of [copyDoneMessage("deleted"), copyDoneMessage("already-gone"), copyStatusText({ step: "deleting" })]) {
      assert.match(text, /^[\x20-\x7E]+$/);
      assert.doesNotMatch(text, /[<>]/);
    }
  });
});
