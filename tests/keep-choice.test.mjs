import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the box "Do not keep this analysis" on the start page connected to the call that
// sends the choice, and they keep the README true to it. Nothing here opens a page in a browser.
// What the call sends to the server is tested in services/api.test.mjs.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const page = read("../app/page.tsx");
const api = read("../services/api.ts");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

describe("start page: the box Do not keep this analysis (app/page.tsx)", () => {
  it("has one checkbox, inside a label that names the choice", () => {
    assert.equal(count(page, /type="checkbox"/g), 1);
    assert.match(page, /<label [^>]*>\s*<input\s+type="checkbox"[\s\S]*?Do not keep this analysis[\s\S]*?<\/label>/);
  });

  it("starts empty, so that by default nothing changes and the server saves", () => {
    assert.match(page, /const \[doNotKeep, setDoNotKeep\] = useState\(false\);/);
    assert.match(page, /checked=\{doNotKeep\}/);
  });

  it("changes the state with the box", () => {
    assert.match(page, /onChange=\{\(event\) => setDoNotKeep\(event\.target\.checked\)\}/);
  });

  it("sends the choice with the file, and only through the options of analyzeDocument", () => {
    assert.match(page, /await analyzeDocument\(file, \{ keep: doNotKeep === false, signal: controller\.signal \}\)/);
    assert.doesNotMatch(page, /analyzeDocument\(file\)/);
  });

  it("is in the upload box, between the upload zone and the Analyze button", () => {
    const zone = page.indexOf("<UploadZone");
    const box = page.indexOf('type="checkbox"');
    const button = page.indexOf("Analyze Document");
    assert.ok(zone > -1 && box > -1 && button > -1, "the upload zone, the box or the button was not found");
    assert.ok(zone < box, "the box is above the upload zone");
    assert.ok(box < button, "the box is below the Analyze button");
  });

  it("keeps the choice when the person analyzes another document", () => {
    const start = page.indexOf("onReset={() => {");
    assert.ok(start > -1, "onReset was not found");
    const reset = page.slice(start, page.indexOf("}}", start));
    assert.match(reset, /setAnalysisData\(null\)/);
    assert.doesNotMatch(reset, /setDoNotKeep/);
  });

  it("says what the box does, and what follows from it", () => {
    assert.match(page, /Normally the server saves each analysis/);
    assert.match(page, /History list/);
    assert.match(page, /ask questions about it later/);
    assert.match(page, /it is gone when you leave the page/);
  });

  it("uses only the colours that have enough contrast on white", () => {
    assert.doesNotMatch(page, /text-gray-400|text-slate-400|text-slate-300/);
  });
});

describe("services/api.ts: the note for a server that saved the analysis anyway", () => {
  it("names the choice, says that the server saved it, and where to delete it", () => {
    assert.match(api, /export const SAVED_ANYWAY_NOTE =/);
    assert.ok(api.includes("You asked not to keep this analysis, but the server saved it anyway."));
    assert.ok(api.includes("You can delete the saved analysis in the History list."));
  });

  it("is added only when the person asked not to keep the analysis", () => {
    assert.match(api, /savedAgainstChoice\(analysis, options\.keep === false\) !== null/);
    assert.match(api, /if \(askedNotToKeep === false\) \{\s*return null;\s*\}\s*return typeof analysis\.id === "string" && analysis\.id !== "" \? analysis\.id : null;/);
  });
});

describe("README: keeping or not keeping an analysis", () => {
  const start = readme.indexOf("## Keeping or not keeping an analysis");
  const end = readme.indexOf("## Other screens");
  const section = readme.slice(start, end);

  it("has the section once, before Other screens", () => {
    assert.equal(count(readme, /^## Keeping or not keeping an analysis$/gm), 1);
    assert.ok(start > -1 && end > start, "the section is missing or in the wrong place");
  });

  it("names the box as the page has it, and says that it starts empty", () => {
    assert.ok(page.includes("Do not keep this analysis"));
    assert.ok(section.includes('"Do not keep this analysis"'));
    assert.match(section, /It starts empty\./);
  });

  it("says what is sent: the field save with false when ticked, nothing when not ticked", () => {
    assert.match(section, /Not ticked \(the default\): the page sends only the file/);
    assert.match(section, /Ticked: the page also sends the form field `save` with the value `false`/);
    assert.match(section, /`analyzeDocument\(file, \{ keep: false \}\)` in `services\/api\.ts`/);
  });

  it("says that the box keeps its state while the page is open, and is not stored", () => {
    assert.match(section, /also after "Analyze Another Document" and after an error/);
    assert.match(section, /The choice is not stored anywhere\./);
  });

  it("says what an unsaved analysis does not have", () => {
    assert.match(section, /no "Saved" time under the title/);
    assert.match(section, /not in the History list/);
    assert.match(section, /no question can be asked about it later/);
  });

  it("says that the server can be set to save nothing, and that the page cannot know it before", () => {
    assert.match(section, /`SAVE_ANALYSES=false`/);
    assert.match(section, /The page cannot know that before an analysis/);
  });

  it("says that an older server saves anyway, and what the page does about it", () => {
    assert.match(section, /older than this choice does not know the field `save` and saves the analysis anyway/);
    assert.match(section, /although the person asked not to keep the analysis/);
    assert.match(section, /It then puts a note first/);
    assert.match(section, /delete the saved analysis in the History list/);
    assert.match(section, /tested with a stand-in for the answer of the server, not with an old server/);
  });

  it("says what was not tried", () => {
    assert.match(section, /The box was not tried in a browser/);
    assert.match(section, /not together with this page/);
  });

  it("is named in the places that describe the call and the page", () => {
    assert.match(readme, /When the box "Do not keep this analysis" is ticked, the page also sends the form field `save` with the value `false`/);
    assert.match(readme, /When it is not ticked, no `save` field is sent\./);
    assert.match(readme, /A box "Do not keep this analysis" under the upload zone/);
    assert.match(readme, /By default the server saves each analysis, so it can be opened again later/);
  });

  it("no longer says that the server saves every analysis without exception", () => {
    assert.equal(readme.includes("The server saves every analysis, so it can be opened again later"), false);
    assert.equal(readme.includes("The server saves every analysis it makes"), false);
  });

  it("is named in the test script of package.json", () => {
    assert.ok(pkg.scripts.test.split(" ").includes("tests/keep-choice.test.mjs"));
  });
});
