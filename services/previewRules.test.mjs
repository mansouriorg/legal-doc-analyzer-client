import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const { canPreviewFile } = await import("./previewRules.ts");
const { ALLOWED_EXTENSIONS } = await import("./uploadRules.ts");

describe("canPreviewFile", () => {
  it("allows PDF files, in any letter case", () => {
    assert.equal(canPreviewFile({ name: "contract.pdf" }), true);
    assert.equal(canPreviewFile({ name: "CONTRACT.PDF" }), true);
  });

  it("does not allow Word files, because the browser would download them", () => {
    assert.equal(canPreviewFile({ name: "contract.doc" }), false);
    assert.equal(canPreviewFile({ name: "contract.docx" }), false);
  });

  it("does not allow a name that only ends with the letters pdf", () => {
    assert.equal(canPreviewFile({ name: "pdf" }), false);
    assert.equal(canPreviewFile({ name: "contractpdf" }), false);
    assert.equal(canPreviewFile({ name: "invoice.pdf.exe" }), false);
    assert.equal(canPreviewFile({ name: "" }), false);
  });

  it("allows exactly one of the extensions that can be uploaded: .pdf", () => {
    const previewable = ALLOWED_EXTENSIONS.filter((extension) => canPreviewFile({ name: "file" + extension }));
    assert.deepEqual(previewable, [".pdf"]);
  });
});
