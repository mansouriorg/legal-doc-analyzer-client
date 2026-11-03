import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const { validateUploadFile, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ALLOWED_EXTENSIONS } = await import("./uploadRules.ts");

const oneMb = 1024 * 1024;

describe("validateUploadFile: file types", () => {
  it("accepts pdf and docx files", () => {
    assert.equal(validateUploadFile({ name: "contract.pdf", size: 1000 }), null);
    assert.equal(validateUploadFile({ name: "contract.docx", size: 1000 }), null);
  });

  it("refuses an old .doc file with a message that says what to do", () => {
    const message = validateUploadFile({ name: "contract.doc", size: 1000 });
    assert.match(message, /"contract.doc" is an old Word file \(\.doc\)/);
    assert.match(message, /save it as \.docx or as a PDF/);
    assert.match(validateUploadFile({ name: "CONTRACT.DOC", size: 1000 }), /old Word file/);
  });

  it("does not take a .docx file for an old .doc file", () => {
    assert.equal(validateUploadFile({ name: "contract.doc.docx", size: 1000 }), null);
    assert.match(validateUploadFile({ name: "contract.docx.doc", size: 1000 }), /old Word file/);
  });

  it("ignores upper and lower case in the extension", () => {
    assert.equal(validateUploadFile({ name: "CONTRACT.PDF", size: 1000 }), null);
    assert.equal(validateUploadFile({ name: "Contract.DocX", size: 1000 }), null);
  });

  it("rejects other file types and names the file in the message", () => {
    const message = validateUploadFile({ name: "notes.txt", size: 1000 });
    assert.match(message, /"notes.txt" is not a PDF or Word document/);
    assert.match(message, /Please choose a \.pdf or \.docx file/);
  });

  it("rejects a program hidden behind a pdf name", () => {
    assert.notEqual(validateUploadFile({ name: "invoice.pdf.exe", size: 1000 }), null);
  });

  it("rejects a name without a dot, even if it ends with the letters pdf", () => {
    assert.notEqual(validateUploadFile({ name: "pdf", size: 1000 }), null);
    assert.notEqual(validateUploadFile({ name: "contractpdf", size: 1000 }), null);
  });
});

describe("validateUploadFile: size", () => {
  it("states a limit of 10 MB", () => {
    assert.equal(MAX_UPLOAD_MB, 10);
    assert.equal(MAX_UPLOAD_BYTES, 10 * oneMb);
    assert.deepEqual(ALLOWED_EXTENSIONS, [".pdf", ".docx"]);
  });

  it("accepts a file of exactly 10 MB", () => {
    assert.equal(validateUploadFile({ name: "big.pdf", size: MAX_UPLOAD_BYTES }), null);
  });

  it("rejects a file one byte over 10 MB, and shows the size rounded up", () => {
    const message = validateUploadFile({ name: "big.pdf", size: MAX_UPLOAD_BYTES + 1 });
    assert.match(message, /"big.pdf" is 10.1 MB/);
    assert.match(message, /limit is 10 MB/);
  });

  it("shows the real size of a very large file", () => {
    const message = validateUploadFile({ name: "huge.docx", size: 25 * oneMb });
    assert.match(message, /is 25.0 MB/);
  });

  it("rejects an empty file", () => {
    assert.match(validateUploadFile({ name: "empty.pdf", size: 0 }), /"empty.pdf" is empty/);
  });

  it("reports the wrong type first when a file is both the wrong type and too big", () => {
    const message = validateUploadFile({ name: "movie.mp4", size: 500 * oneMb });
    assert.match(message, /not a PDF or Word document/);
  });
});
