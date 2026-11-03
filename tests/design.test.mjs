import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the design fixes of update 3 from being undone by accident.
// If you later decide to add a real dark mode, change the second test on purpose.

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("global styles (app/globals.css)", () => {
  const css = read("../app/globals.css");

  it("uses the Geist font that layout.tsx loads, not Arial", () => {
    assert.match(css, /font-family:\s*var\(--font-geist-sans\)/);
    assert.doesNotMatch(css, /Arial/);
  });

  it("is light only, because every component is built with light colours", () => {
    assert.doesNotMatch(css, /prefers-color-scheme:\s*dark/);
    assert.match(css, /color-scheme:\s*light/);
  });

  it("draws a visible ring around the element that has keyboard focus", () => {
    assert.match(css, /:focus-visible/);
    assert.match(css, /outline:\s*2px solid/);
  });
});

describe("navigation (app/layout.tsx)", () => {
  const layout = read("../app/layout.tsx");

  it("shows the links on small screens too", () => {
    assert.doesNotMatch(layout, /hidden sm:flex/);
    assert.match(layout, /href="\/dashboard"/);
  });

  it("has no fake user avatar", () => {
    assert.doesNotMatch(layout, /Mock User Profile/);
    assert.doesNotMatch(layout, />\s*JD\s*</);
  });
});

describe("upload button (app/page.tsx)", () => {
  const page = read("../app/page.tsx");

  it("does not use white text on a light grey button when it is disabled", () => {
    assert.doesNotMatch(page, /bg-slate-300 cursor-not-allowed/);
    assert.match(page, /bg-slate-200 text-slate-600 cursor-not-allowed/);
  });
});
