import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the fixes of update 4 from being undone by accident.

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("upload zone (components/document/UploadZone.tsx)", () => {
  const zone = read("../components/document/UploadZone.tsx");

  it("keeps the file input reachable with the keyboard (visually hidden, not display none)", () => {
    assert.match(zone, /type="file"[\s\S]*?className="sr-only"/);
    assert.doesNotMatch(zone, /type="file"[\s\S]*?className="hidden"/);
  });

  it("checks every file with the shared rules, for clicking and for dropping", () => {
    assert.match(zone, /from "@\/services\/uploadRules"/);
    assert.match(zone, /validateUploadFile\(file\)/);
    assert.match(zone, /acceptFile\(chosenFile\)/);
    assert.match(zone, /acceptFile\(e\.dataTransfer\.files\[0\]\)/);
  });

  it("shows problems on the page and not in a pop-up", () => {
    assert.doesNotMatch(zone, /alert\(/);
    assert.match(zone, /role="alert"/);
  });

  it("prints the limit from the shared rules instead of a fixed number", () => {
    assert.match(zone, /Max \{MAX_UPLOAD_MB\} MB/);
    assert.doesNotMatch(zone, /10MB/);
  });

  it("offers only PDF and DOCX files, because the server cannot read old .doc files", () => {
    assert.match(zone, /accept="\.pdf,\.docx"/);
    assert.match(zone, /Supports PDF and DOCX/);
    assert.doesNotMatch(zone, /DOC,/);
    assert.doesNotMatch(zone, /accept="[^"]*\.doc[,"]/);
  });

  it("marks the zone so the keyboard focus ring can be drawn around all of it", () => {
    assert.match(zone, /data-upload-zone/);
    const css = read("../app/globals.css");
    assert.match(css, /\[data-upload-zone\]:has\(input:focus-visible\)/);
  });
});
