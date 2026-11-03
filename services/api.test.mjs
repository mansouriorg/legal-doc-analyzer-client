import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const {
  ASK_STOPPED_MESSAGE,
  SAVED_ANYWAY_NOTE,
  analyzeDocument,
  cleanNotes,
  deleteDocument,
  getDemoAnalysis,
  getDocumentById,
  listDocuments,
  askDocumentQuestion,
} = await import("./api.ts");

// Web classes that Node provides globally. They are read from globalThis so lint rules about undefined globals stay quiet.
const { AbortController, DOMException, File, FormData } = globalThis;

// The tests below expect the default address of the server, so a setting NEXT_PUBLIC_API_URL in the terminal must not change them.
// services/apiAddress.test.mjs tests the setting.
delete process.env.NEXT_PUBLIC_API_URL;

const realFetch = globalThis.fetch;
let calls = [];

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

const sampleAnalysis = {
  documentName: "NDA.pdf",
  executiveSummary: "Short summary.",
  clauses: [],
};

describe("analyzeDocument", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sends the file as the form field document with POST", async () => {
    stubFetch(200, sampleAnalysis);
    const file = new File(["hello"], "contract.pdf", { type: "application/pdf" });
    await analyzeDocument(file);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/analyze");
    assert.equal(calls[0].options.method, "POST");
    assert.ok(calls[0].options.body instanceof FormData);
    assert.equal(calls[0].options.body.get("document").name, "contract.pdf");
  });

  it("returns the analysis from the server and does not mark it as demo", async () => {
    stubFetch(200, sampleAnalysis);
    const result = await analyzeDocument(new File(["x"], "a.pdf"));
    assert.deepEqual(result, sampleAnalysis);
    assert.equal(result.isDemo, undefined);
  });

  it("throws a clear message when the server cannot be reached", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(
      () => analyzeDocument(new File(["x"], "a.pdf")),
      /Could not reach the server at http:\/\/localhost:3001/,
    );
  });

  it("throws with the status when the server answers 500, and never returns demo data", async () => {
    stubFetch(500, {});
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), /status 500/);
  });

  it("shows the message of the server when it answers 400 (the file was not accepted)", async () => {
    const message = '"notes.txt" is not a PDF or Word document. Please choose a .pdf, .doc or .docx file.';
    stubFetch(400, { message: message, error: "Bad Request", statusCode: 400 });
    await assert.rejects(() => analyzeDocument(new File(["x"], "notes.txt")), { message: message });
  });

  it("shows the message of the server for every answer that the server writes for the person", async () => {
    const answers = [
      [415, '"old.doc" is an old Word file (.doc), which cannot be read yet. Please open it in Word and save it as .docx or as a PDF.'],
      [422, "The PDF is protected by a password. Please remove the protection and upload it again."],
      [502, 'The AI service does not know the model "x" (HTTP 404). Check AI_MODEL and AI_BASE_URL.'],
      [503, "The AI service at 127.0.0.1:11434 could not be reached. Is it running, and is AI_BASE_URL right?"],
      [504, "The AI service did not answer within 120 seconds. Try a shorter document, a faster model, or a larger AI_TIMEOUT_SECONDS."],
    ];
    for (const [status, message] of answers) {
      stubFetch(status, { message: message, statusCode: status });
      await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), { message: message });
    }
  });

  it("shows only the status for 404, 500 and 501, whatever text comes with them", async () => {
    for (const status of [404, 500, 501]) {
      stubFetch(status, { message: "Some text from the server or from a proxy.", statusCode: status });
      await assert.rejects(
        () => analyzeDocument(new File(["x"], "a.pdf")),
        (error) => {
          assert.match(error.message, new RegExp("status " + status));
          assert.doesNotMatch(error.message, /Some text/);
          return true;
        },
      );
    }
  });

  it("joins a list of messages into one text", async () => {
    stubFetch(400, { message: ["first problem", "second problem"] });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), {
      message: "first problem second problem",
    });
  });

  it("removes spaces around the message of the server", async () => {
    stubFetch(400, { message: "  Please choose a different file.  " });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), {
      message: "Please choose a different file.",
    });
  });

  it("uses its own text for 413, whatever the server or a proxy in front of it says", async () => {
    const own = "The file is too large for the server. Please choose a smaller file.";
    stubFetch(413, { message: "File too large" });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), { message: own });
    globalThis.fetch = async () => ({
      status: 413,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), { message: own });
  });

  it("falls back to the status when a 400 or 503 answer has no usable message", async () => {
    const bodies = [{}, { message: "" }, { message: "   " }, { message: 42 }, { message: [1, 2] }, null];
    for (const body of bodies) {
      stubFetch(400, body);
      await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), /status 400/);
    }
    globalThis.fetch = async () => ({
      status: 503,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), /status 503/);
  });

  it("does not show the text of other server errors, only the status", async () => {
    stubFetch(500, { message: "Internal server error", statusCode: 500 });
    await assert.rejects(
      () => analyzeDocument(new File(["x"], "a.pdf")),
      (error) => {
        assert.match(error.message, /status 500/);
        assert.doesNotMatch(error.message, /Internal server error/);
        return true;
      },
    );
  });

  it("cuts a very long message of the server to 300 characters", async () => {
    stubFetch(400, { message: "a".repeat(500) });
    await assert.rejects(
      () => analyzeDocument(new File(["x"], "a.pdf")),
      (error) => {
        assert.equal(error.message, "a".repeat(300) + "...");
        return true;
      },
    );
  });

  it("throws when the answer is not valid JSON", async () => {
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), /not valid data/);
  });

  it("throws when the answer has no clauses", async () => {
    stubFetch(200, { documentName: "NDA.pdf", executiveSummary: "Short summary." });
    await assert.rejects(
      () => analyzeDocument(new File(["x"], "a.pdf")),
      /missing the summary or the clauses/,
    );
  });

  it("throws when the answer is null", async () => {
    stubFetch(200, null);
    await assert.rejects(
      () => analyzeDocument(new File(["x"], "a.pdf")),
      /missing the summary or the clauses/,
    );
  });
});

describe("analyzeDocument: notes", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("passes on the notes of the server unchanged", async () => {
    stubFetch(200, { ...sampleAnalysis, notes: ["First note.", "Second note."] });
    const result = await analyzeDocument(new File(["x"], "a.pdf"));
    assert.deepEqual(result.notes, ["First note.", "Second note."]);
  });

  it("accepts an answer without notes", async () => {
    stubFetch(200, sampleAnalysis);
    const result = await analyzeDocument(new File(["x"], "a.pdf"));
    assert.equal(result.notes, undefined);
  });
});

describe("analyzeDocument: saved analyses", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("keeps the id and the time of saving that the server sends", async () => {
    stubFetch(200, { ...sampleAnalysis, id: "6ff69752-c563-4095-b6d4-71a3a62a9221", savedAt: "2026-10-25T16:30:00.000Z" });
    const result = await analyzeDocument(new File(["x"], "a.pdf"));
    assert.equal(result.id, "6ff69752-c563-4095-b6d4-71a3a62a9221");
    assert.equal(result.savedAt, "2026-10-25T16:30:00.000Z");
  });

  it("accepts an answer without them, which is what the server sends when it could not save the analysis", async () => {
    stubFetch(200, sampleAnalysis);
    const result = await analyzeDocument(new File(["x"], "a.pdf"));
    assert.equal(result.id, undefined);
    assert.equal(result.savedAt, undefined);
  });
});

describe("analyzeDocument: the choice not to keep the analysis", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const pdf = () => new File(["hello"], "contract.pdf", { type: "application/pdf" });
  const savedAnalysis = {
    ...sampleAnalysis,
    id: "6ff69752-c563-4095-b6d4-71a3a62a9221",
    savedAt: "2026-10-25T16:30:00.000Z",
  };

  it("sends no save field when no option is given", async () => {
    stubFetch(200, sampleAnalysis);
    await analyzeDocument(pdf());
    assert.equal(calls[0].options.body.has("save"), false);
    assert.deepEqual([...calls[0].options.body.keys()], ["document"]);
  });

  it("sends no save field when keep is true or missing", async () => {
    for (const options of [{}, { keep: true }, { keep: undefined }]) {
      calls = [];
      stubFetch(200, sampleAnalysis);
      await analyzeDocument(pdf(), options);
      assert.equal(calls[0].options.body.has("save"), false);
    }
  });

  it("sends the field save with the value false, next to the file, when keep is false", async () => {
    stubFetch(200, sampleAnalysis);
    await analyzeDocument(pdf(), { keep: false });
    const body = calls[0].options.body;
    assert.equal(calls[0].url, "http://localhost:3001/analyze");
    assert.equal(calls[0].options.method, "POST");
    assert.deepEqual(body.getAll("save"), ["false"]);
    assert.equal(body.get("document").name, "contract.pdf");
    assert.deepEqual([...body.keys()].sort(), ["document", "save"]);
  });

  it("sends the field only for the value false, not for other values that look like no", async () => {
    for (const keep of [null, 0, "", "false", "no"]) {
      calls = [];
      stubFetch(200, sampleAnalysis);
      await analyzeDocument(pdf(), { keep });
      assert.equal(calls[0].options.body.has("save"), false, String(keep));
    }
  });

  it("returns the analysis unchanged when the server did not save it", async () => {
    const note = "You asked not to keep this analysis, so it was not saved.";
    stubFetch(200, { ...sampleAnalysis, notes: [note] });
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.deepEqual(result.notes, [note]);
    assert.equal(result.id, undefined);
    assert.equal(result.savedAt, undefined);
  });

  it("accepts an answer without notes and without an id", async () => {
    stubFetch(200, sampleAnalysis);
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.equal(result.notes, undefined);
    assert.equal(result.id, undefined);
  });

  it("puts a note first when the server saved the analysis although the person asked not to keep it", async () => {
    stubFetch(200, { ...savedAnalysis, notes: ["Note of the server."] });
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.deepEqual(result.notes, [SAVED_ANYWAY_NOTE, "Note of the server."]);
    assert.equal(result.id, savedAnalysis.id);
    assert.equal(result.savedAt, savedAnalysis.savedAt);
    assert.equal(result.documentName, "NDA.pdf");
  });

  it("puts the note also when the answer has no notes", async () => {
    stubFetch(200, savedAnalysis);
    const result = await analyzeDocument(pdf(), { keep: false });
    assert.deepEqual(result.notes, [SAVED_ANYWAY_NOTE]);
  });

  it("does not put the note when the person did not ask for it", async () => {
    for (const options of [undefined, {}, { keep: true }]) {
      stubFetch(200, savedAnalysis);
      const result = await analyzeDocument(pdf(), options);
      assert.equal(result.notes, undefined);
      assert.equal(result.id, savedAnalysis.id);
    }
  });

  it("does not put the note when the id is empty or is not text", async () => {
    for (const id of ["", null, 5, undefined]) {
      stubFetch(200, { ...sampleAnalysis, id: id });
      const result = await analyzeDocument(pdf(), { keep: false });
      assert.equal(result.notes, undefined, String(id));
    }
  });

  it("keeps the note among the ten that the results page shows, also when the server sends many", async () => {
    const many = Array.from({ length: 12 }, (_, index) => "Note " + index + ".");
    stubFetch(200, { ...savedAnalysis, notes: many });
    const result = await analyzeDocument(pdf(), { keep: false });
    const shown = cleanNotes(result.notes);
    assert.equal(shown.length, 10);
    assert.equal(shown[0], SAVED_ANYWAY_NOTE);
  });

  it("has a note that is short, plain, and says where to delete the analysis", () => {
    assert.ok(SAVED_ANYWAY_NOTE.length < 500);
    assert.match(SAVED_ANYWAY_NOTE, /^[\x20-\x7e]+$/);
    assert.match(SAVED_ANYWAY_NOTE, /saved it anyway/);
    assert.match(SAVED_ANYWAY_NOTE, /History list/);
  });

  it("does not change the errors", async () => {
    stubFetch(503, { message: "The AI service cannot be used now." });
    await assert.rejects(() => analyzeDocument(pdf(), { keep: false }), { message: "The AI service cannot be used now." });
    stubFetch(500, { message: "Internal server error" });
    await assert.rejects(() => analyzeDocument(pdf(), { keep: false }), /status 500/);
  });
});

describe("cleanNotes", () => {
  it("returns the texts of a list", () => {
    assert.deepEqual(cleanNotes(["One.", "Two."]), ["One.", "Two."]);
  });

  it("gives an empty list for anything that is not a list", () => {
    for (const value of [undefined, null, "A note.", 42, {}, { length: 1, 0: "A note." }]) {
      assert.deepEqual(cleanNotes(value), []);
    }
  });

  it("leaves out what is not text, empty texts and repeats", () => {
    assert.deepEqual(cleanNotes(["One.", 7, null, "", "   ", "One.", { text: "x" }, "Two."]), ["One.", "Two."]);
  });

  it("removes spaces around a note, and then sees the repeats", () => {
    assert.deepEqual(cleanNotes(["  One.  ", "One."]), ["One."]);
  });

  it("keeps at most 10 notes", () => {
    const many = Array.from({ length: 25 }, (_, index) => "Note " + index + ".");
    const result = cleanNotes(many);
    assert.equal(result.length, 10);
    assert.equal(result[0], "Note 0.");
    assert.equal(result[9], "Note 9.");
  });

  it("cuts a very long note to 500 characters", () => {
    const result = cleanNotes(["a".repeat(800)]);
    assert.equal(result[0], "a".repeat(500) + "...");
  });

  it("keeps a note of exactly 500 characters as it is, and cuts one of 501", () => {
    assert.equal(cleanNotes(["a".repeat(500)])[0], "a".repeat(500));
    assert.equal(cleanNotes(["a".repeat(501)])[0], "a".repeat(500) + "...");
  });

  it("does not change the list it was given", () => {
    const given = ["  One.  ", "One.", 3];
    cleanNotes(given);
    assert.deepEqual(given, ["  One.  ", "One.", 3]);
  });
});

describe("getDemoAnalysis", () => {
  it("is always marked as demo and says it is not the user's document", () => {
    const demo = getDemoAnalysis();
    assert.equal(demo.isDemo, true);
    assert.match(demo.documentName, /Demo/);
    assert.match(demo.documentName, /not your document/);
  });

  it("has three clauses with different ids", () => {
    const demo = getDemoAnalysis();
    assert.equal(demo.clauses.length, 3);
    assert.equal(new Set(demo.clauses.map((clause) => clause.id)).size, 3);
  });
});

describe("getDocumentById", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns the analysis when the server answers 200", async () => {
    stubFetch(200, sampleAnalysis);
    const result = await getDocumentById("doc_1");
    assert.deepEqual(result, sampleAnalysis);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/documents/doc_1");
    assert.equal(calls[0].options.cache, "no-store");
  });

  it("returns null when the server answers 404", async () => {
    stubFetch(404, { message: "Not Found" });
    assert.equal(await getDocumentById("missing"), null);
  });

  it("throws when the server answers 500", async () => {
    stubFetch(500, {});
    await assert.rejects(() => getDocumentById("doc_1"), /status 500/);
  });

  it("passes network errors on to the caller", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(() => getDocumentById("doc_1"), /fetch failed/);
  });

  it("encodes the id so it cannot change the URL path", async () => {
    stubFetch(200, sampleAnalysis);
    await getDocumentById("a/b?c");
    assert.equal(calls[0].url, "http://localhost:3001/documents/a%2Fb%3Fc");
  });
});

function summaryRow(overrides) {
  return {
    id: "a1",
    documentName: "NDA.pdf",
    savedAt: "2026-10-25T16:30:00.000Z",
    clauseCount: 3,
    highRisks: 1,
    mediumRisks: 1,
    lowRisks: 1,
    ...overrides,
  };
}

describe("listDocuments", () => {
  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("asks GET /documents and never uses the cache of the browser or of Next.js", async () => {
    stubFetch(200, { documents: [], total: 0, unreadable: 0 });
    await listDocuments();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/documents");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[0].options.method, undefined);
  });

  it("returns the rows, the total and the number of files that could not be read", async () => {
    const rows = [summaryRow({ id: "b2", documentName: "Lease.docx" }), summaryRow({ id: "a1" })];
    stubFetch(200, { documents: rows, total: 2, unreadable: 1 });
    const list = await listDocuments();
    assert.deepEqual(list, { documents: rows, total: 2, unreadable: 1 });
  });

  it("returns an empty list as it is", async () => {
    stubFetch(200, { documents: [], total: 0, unreadable: 0 });
    assert.deepEqual(await listDocuments(), { documents: [], total: 0, unreadable: 0 });
  });

  it("keeps the total of the server when it is larger than the rows it sent", async () => {
    stubFetch(200, { documents: [summaryRow({})], total: 130, unreadable: 0 });
    const list = await listDocuments();
    assert.equal(list.documents.length, 1);
    assert.equal(list.total, 130);
  });

  it("keeps only the fields of a row that the page uses", async () => {
    stubFetch(200, { documents: [{ ...summaryRow({}), executiveSummary: "secret", path: "/Users/me/data" }], total: 1, unreadable: 0 });
    const list = await listDocuments();
    assert.deepEqual(Object.keys(list.documents[0]).sort(), [
      "clauseCount",
      "documentName",
      "highRisks",
      "id",
      "lowRisks",
      "mediumRisks",
      "savedAt",
    ]);
  });

  it("leaves out a row that cannot be used, and keeps the other rows", async () => {
    const wrong = [
      null,
      "text",
      42,
      [],
      {},
      summaryRow({ id: "" }),
      summaryRow({ id: 7 }),
      summaryRow({ documentName: 7 }),
      summaryRow({ savedAt: 7 }),
      summaryRow({ clauseCount: "3" }),
      summaryRow({ highRisks: -1 }),
      summaryRow({ mediumRisks: 1.5 }),
      summaryRow({ lowRisks: Number.NaN }),
      summaryRow({ lowRisks: null }),
    ];
    const good = summaryRow({ id: "good" });
    stubFetch(200, { documents: [...wrong.slice(0, 7), good, ...wrong.slice(7)], total: 15, unreadable: 0 });
    const list = await listDocuments();
    assert.deepEqual(list.documents, [good]);
    assert.equal(list.total, 15);
  });

  it("keeps the first of two rows that have the same id, so that no key is used twice", async () => {
    const first = summaryRow({ id: "same", documentName: "First.pdf" });
    const second = summaryRow({ id: "same", documentName: "Second.pdf" });
    stubFetch(200, { documents: [first, second], total: 2, unreadable: 0 });
    const list = await listDocuments();
    assert.deepEqual(list.documents, [first]);
  });

  it("throws a clear message when the server cannot be reached", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(() => listDocuments(), {
      message: "Could not reach the server at http://localhost:3001. Check that the backend is running.",
    });
  });

  it("throws with the status when the server does not answer 200", async () => {
    for (const status of [404, 500, 503]) {
      stubFetch(status, {});
      await assert.rejects(() => listDocuments(), {
        message: `The server could not list the saved analyses (status ${status}).`,
      });
    }
  });

  it("does not show the text that comes with an error of the server", async () => {
    stubFetch(500, { message: "EACCES: permission denied, scandir '/Users/me/secret-folder'" });
    await assert.rejects(() => listDocuments(), (error) => {
      assert.doesNotMatch(error.message, /EACCES|secret-folder|Users/);
      return true;
    });
  });

  it("throws when the answer is not valid JSON", async () => {
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    await assert.rejects(() => listDocuments(), /not valid data/);
  });

  it("throws when the answer does not have the form of a list", async () => {
    const wrong = [
      null,
      "text",
      [],
      {},
      { documents: {}, total: 0, unreadable: 0 },
      { documents: [], unreadable: 0 },
      { documents: [], total: 0 },
      { documents: [], total: -1, unreadable: 0 },
      { documents: [], total: 1.5, unreadable: 0 },
      { documents: [], total: "0", unreadable: 0 },
      { documents: [], total: 0, unreadable: null },
    ];
    for (const body of wrong) {
      stubFetch(200, body);
      await assert.rejects(() => listDocuments(), /list of saved analyses is not valid/, JSON.stringify(body));
    }
  });
});

describe("deleteDocument", () => {
  const NOT_SAVED = "There is no saved analysis with this id.";
  const DELETE_FAILED = "The saved analysis could not be deleted. The reason is in the log of the server.";

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("sends DELETE to the address of the analysis, without a body and without a cache, and says deleted for 204", async () => {
    stubFetch(204, undefined);
    assert.equal(await deleteDocument("doc_1"), "deleted");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/documents/doc_1");
    assert.equal(calls[0].options.method, "DELETE");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[0].options.body, undefined);
  });

  it("does not read the answer of a 204, which has no body", async () => {
    globalThis.fetch = async () => ({
      status: 204,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    assert.equal(await deleteDocument("doc_1"), "deleted");
  });

  it("encodes the id so it cannot change the URL path", async () => {
    stubFetch(204, undefined);
    await deleteDocument("a/b?c");
    assert.equal(calls[0].url, "http://localhost:3001/documents/a%2Fb%3Fc");
  });

  it("sends nothing for an empty id, or for . and .., which would change the path", async () => {
    stubFetch(204, undefined);
    for (const id of ["", "   ", ".", ".."]) {
      await assert.rejects(() => deleteDocument(id), /no usable id/);
    }
    assert.equal(calls.length, 0);
  });

  it("says already-gone when the server says that no analysis has this id", async () => {
    stubFetch(404, { statusCode: 404, message: NOT_SAVED, error: "Not Found" });
    assert.equal(await deleteDocument("doc_1"), "already-gone");
  });

  it("does not say already-gone for a 404 with another text, because an older server answers like that", async () => {
    stubFetch(404, { statusCode: 404, message: "Cannot DELETE /documents/doc_1", error: "Not Found" });
    await assert.rejects(() => deleteDocument("doc_1"), (error) => {
      assert.match(error.message, /status 404/);
      assert.match(error.message, /older version/);
      return true;
    });
  });

  it("does not say already-gone for a 404 without a usable text", async () => {
    stubFetch(404, {});
    await assert.rejects(() => deleteDocument("doc_1"), /older version/);
    globalThis.fetch = async () => ({
      status: 404,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    await assert.rejects(() => deleteDocument("doc_1"), /older version/);
  });

  it("shows the fixed message of the server when the delete failed (500)", async () => {
    stubFetch(500, { statusCode: 500, message: DELETE_FAILED, error: "Internal Server Error" });
    await assert.rejects(() => deleteDocument("doc_1"), { message: DELETE_FAILED });
  });

  it("shows only the status for a 500 with any other text", async () => {
    stubFetch(500, { statusCode: 500, message: "EACCES: permission denied, unlink '/Users/me/data/x.json'" });
    await assert.rejects(() => deleteDocument("doc_1"), (error) => {
      assert.equal(error.message, "The server could not delete this analysis (status 500).");
      return true;
    });
    stubFetch(500, { message: "Internal server error" });
    await assert.rejects(() => deleteDocument("doc_1"), /status 500\)\.$/);
  });

  it("throws with the status for every other answer, also for a 200, which is not the 204 of the server", async () => {
    for (const status of [200, 202, 400, 401, 403, 405, 502, 503]) {
      stubFetch(status, { message: "private detail" });
      await assert.rejects(() => deleteDocument("doc_1"), (error) => {
        assert.equal(error.message, `The server could not delete this analysis (status ${status}).`);
        return true;
      });
    }
  });

  it("throws a clear message when the server cannot be reached", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(() => deleteDocument("doc_1"), /Could not reach the server at http:\/\/localhost:3001/);
  });
});

describe("askDocumentQuestion", () => {
  const NOT_SAVED = "There is no saved analysis with this id.";
  const NOT_READABLE = "The saved file of this analysis cannot be read. It may have been changed or damaged.";

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("posts the question and the earlier turns as JSON to the ask address, without a cache, and returns the answer", async () => {
    stubFetch(200, { answer: "Yes." });
    const history = [{ id: "m1", role: "ai", content: "Hello" }];
    const result = await askDocumentQuestion("doc_1", "Is there a non-compete?", history);
    assert.deepEqual(result, { answer: "Yes." });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/documents/doc_1/ask");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      question: "Is there a non-compete?",
      history: [{ role: "ai", content: "Hello" }],
    });
  });

  it("sends an empty history as an empty list, and the turns in the order given", async () => {
    stubFetch(200, { answer: "Yes." });
    await askDocumentQuestion("doc_1", "Q", []);
    assert.deepEqual(JSON.parse(calls[0].options.body).history, []);
    await askDocumentQuestion("doc_1", "Q2", [
      { role: "user", content: "a" },
      { role: "ai", content: "b" },
    ]);
    assert.deepEqual(JSON.parse(calls[1].options.body).history, [
      { role: "user", content: "a" },
      { role: "ai", content: "b" },
    ]);
  });

  it("returns the answer without the spaces around it", async () => {
    stubFetch(200, { answer: "  Yes.\n" });
    assert.deepEqual(await askDocumentQuestion("doc_1", "Q", []), { answer: "Yes." });
  });

  it("encodes the id so it cannot change the URL path", async () => {
    stubFetch(200, { answer: "Yes." });
    await askDocumentQuestion("a/b?c", "Q", []);
    assert.equal(calls[0].url, "http://localhost:3001/documents/a%2Fb%3Fc/ask");
  });

  it("sends nothing for an empty id, or for . and .., which would change the path", async () => {
    stubFetch(200, { answer: "Yes." });
    for (const id of ["", "   ", ".", ".."]) {
      await assert.rejects(() => askDocumentQuestion(id, "Q", []), /no usable id/);
    }
    assert.equal(calls.length, 0);
  });

  it("shows the message of the server for 400, 502, 503 and 504", async () => {
    for (const status of [400, 502, 503, 504]) {
      stubFetch(status, { statusCode: status, message: `Message for ${status}.`, error: "x" });
      await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), { message: `Message for ${status}.` });
    }
  });

  it("joins a list of messages, and cuts a message that is very long", async () => {
    stubFetch(400, { message: ["The question is missing.", "Send it as text."] });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), { message: "The question is missing. Send it as text." });
    stubFetch(503, { message: "x".repeat(400) });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), (error) => {
      assert.equal(error.message, `${"x".repeat(300)}...`);
      return true;
    });
  });

  it("shows only the status for 400, 502, 503 and 504 without a usable message", async () => {
    for (const status of [400, 502, 503, 504]) {
      for (const body of [{}, { message: "   " }, { message: 5 }, null]) {
        stubFetch(status, body);
        await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), {
          message: `The server could not answer this question (status ${status}).`,
        });
      }
      globalThis.fetch = async () => ({
        status,
        ok: false,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      });
      await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /status \d{3}\)\.$/);
    }
  });

  it("says that the analysis is no longer saved when the server says that no analysis has this id", async () => {
    stubFetch(404, { statusCode: 404, message: NOT_SAVED, error: "Not Found" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), (error) => {
      assert.match(error.message, /no longer saved/);
      assert.doesNotMatch(error.message, /older version/);
      return true;
    });
  });

  it("says that the server may be older for a 404 with another text, or without a usable text", async () => {
    stubFetch(404, { statusCode: 404, message: "Cannot POST /documents/doc_1/ask", error: "Not Found" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), (error) => {
      assert.match(error.message, /status 404/);
      assert.match(error.message, /older version/);
      assert.doesNotMatch(error.message, /no longer saved/);
      return true;
    });
    stubFetch(404, {});
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /older version/);
    globalThis.fetch = async () => ({
      status: 404,
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /older version/);
  });

  it("shows the fixed text of the server for a saved file that cannot be read, and only the status for any other 500", async () => {
    stubFetch(500, { statusCode: 500, message: NOT_READABLE, error: "Internal Server Error" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), { message: NOT_READABLE });

    stubFetch(500, { statusCode: 500, message: "EACCES: permission denied, open '/Users/me/data/x.json'" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), {
      message: "The server could not answer this question (status 500).",
    });
    stubFetch(500, { message: "Internal server error" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /status 500\)\.$/);
  });

  it("says that the conversation is too big for a 413, whatever the server says", async () => {
    stubFetch(413, { message: "request entity too large" });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), (error) => {
      assert.match(error.message, /too big for the server/);
      assert.doesNotMatch(error.message, /request entity/);
      return true;
    });
  });

  it("throws with the status for every other answer, and never shows its text", async () => {
    for (const status of [301, 401, 403, 405, 415, 422, 429, 501]) {
      stubFetch(status, { message: "private detail", answer: "not an answer" });
      await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), (error) => {
        assert.equal(error.message, `The server could not answer this question (status ${status}).`);
        return true;
      });
    }
  });

  it("throws a clear message when the server cannot be reached", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /Could not reach the server at http:\/\/localhost:3001/);
  });

  it("throws when the answer is not valid data, or has no text", async () => {
    globalThis.fetch = async () => ({
      status: 200,
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });
    await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /not valid data/);

    for (const body of [{}, { answer: "" }, { answer: "   \n" }, { answer: 5 }, { answer: null }, { answer: ["Yes."] }, null, "Yes.", []]) {
      stubFetch(200, body);
      await assert.rejects(() => askDocumentQuestion("doc_1", "Q", []), /answer has no text/);
    }
  });

  // A fetch that never answers and rejects when its signal is aborted, like the fetch of a browser.
  function hangingFetch() {
    globalThis.fetch = (url, options) => {
      calls.push({ url: String(url), options: options });
      const { promise, reject } = Promise.withResolvers();
      const stop = () => reject(new DOMException("This operation was aborted", "AbortError"));
      if (options.signal.aborted) {
        stop();
      } else {
        options.signal.addEventListener("abort", stop);
      }
      return promise;
    };
  }

  // An answer whose body never arrives: reading it fails when the signal is aborted.
  function hangingBody(status, signal) {
    globalThis.fetch = async () => ({
      status,
      ok: status >= 200 && status < 300,
      json: () => {
        const { promise, reject } = Promise.withResolvers();
        signal.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "AbortError")));
        return promise;
      },
    });
  }

  const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  it("has a message for a stop that says what happened and nothing private", () => {
    assert.equal(ASK_STOPPED_MESSAGE, "The question was stopped before the server answered.");
  });

  it("passes the signal to fetch, so that the browser can drop the request", async () => {
    stubFetch(200, { answer: "Yes." });
    const controller = new AbortController();
    await askDocumentQuestion("doc_1", "Q", [], controller.signal);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.signal, controller.signal);
  });

  it("sends no signal when none is given", async () => {
    stubFetch(200, { answer: "Yes." });
    await askDocumentQuestion("doc_1", "Q", []);
    assert.equal(calls[0].options.signal, undefined);
  });

  it("throws the message of the stop, and not another reason, when the request is stopped while it waits", async () => {
    hangingFetch();
    const controller = new AbortController();
    const result = assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), { message: ASK_STOPPED_MESSAGE });
    controller.abort();
    await result;
  });

  it("does not say that the server could not be reached when the request is stopped", async () => {
    hangingFetch();
    const controller = new AbortController();
    const result = askDocumentQuestion("doc_1", "Q", [], controller.signal).then(
      () => "an answer",
      (error) => error.message,
    );
    controller.abort();
    const message = await result;
    assert.doesNotMatch(message, /Could not reach the server/);
    assert.equal(message, ASK_STOPPED_MESSAGE);
  });

  it("throws the message of the stop when the signal was stopped before the call", async () => {
    hangingFetch();
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), { message: ASK_STOPPED_MESSAGE });
  });

  it("throws the message of the stop when the request is stopped while the answer is being read", async () => {
    const controller = new AbortController();
    hangingBody(200, controller.signal);
    const result = assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), { message: ASK_STOPPED_MESSAGE });
    await later(5);
    controller.abort();
    await result;
  });

  it("throws the message of the stop when the request is stopped while the message of an error is being read", async () => {
    for (const status of [400, 404, 500, 504]) {
      const controller = new AbortController();
      hangingBody(status, controller.signal);
      const result = assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), { message: ASK_STOPPED_MESSAGE });
      await later(5);
      controller.abort();
      await result;
    }
  });

  it("keeps the usual reasons when a signal is given and not used", async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), /Could not reach the server at http:\/\/localhost:3001/);
    stubFetch(504, { message: "The AI service did not answer within 120 seconds." });
    await assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), { message: "The AI service did not answer within 120 seconds." });
    stubFetch(200, {});
    await assert.rejects(askDocumentQuestion("doc_1", "Q", [], controller.signal), /answer has no text/);
    stubFetch(200, { answer: " Yes. " });
    assert.deepEqual(await askDocumentQuestion("doc_1", "Q", [], controller.signal), { answer: "Yes." });
  });

  it("returns an answer that came in before the stop, and does not change it afterwards", async () => {
    stubFetch(200, { answer: "Yes." });
    const controller = new AbortController();
    const result = await askDocumentQuestion("doc_1", "Q", [], controller.signal);
    controller.abort();
    assert.deepEqual(result, { answer: "Yes." });
  });
});
