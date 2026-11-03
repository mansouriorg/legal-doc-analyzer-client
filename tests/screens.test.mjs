import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These are simple text checks. They keep the fixes of update 6 from being undone by accident.

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

describe("page height (a navigation bar sits above every page)", () => {
  it("makes the area under the navigation bar a column that fills the window", () => {
    assert.match(read("../app/layout.tsx"), /<div className="flex flex-grow flex-col">/);
  });

  it("does not make a page as tall as the whole window on top of the navigation bar", () => {
    for (const file of ["../app/page.tsx", "../app/error.tsx", "../app/loading.tsx", "../app/not-found.tsx"]) {
      assert.doesNotMatch(read(file), /min-h-screen/, file);
    }
  });

  it("lets the start page, the error page, the loading page and the not-found page fill the free space", () => {
    assert.match(read("../app/page.tsx"), /<main className="flex-grow /);
    assert.match(read("../app/error.tsx"), /<div className="flex-grow /);
    assert.match(read("../app/loading.tsx"), /<div className="flex-grow /);
    assert.match(read("../app/not-found.tsx"), /<main className="flex-grow /);
  });

  it("keeps the dashboard at full width inside that column", () => {
    assert.match(read("../app/dashboard/page.tsx"), /<main className="w-full max-w-7xl mx-auto/);
  });
});

describe("analysis loading screen (components/ui/LoadingState.tsx)", () => {
  const state = read("../components/ui/LoadingState.tsx");

  it("has no progress bar that fills up on a timer", () => {
    assert.doesNotMatch(state, /style=\{\{ width/);
    assert.doesNotMatch(state, /overflow-hidden/);
  });

  it("gives screen readers one steady message instead of the changing lines", () => {
    assert.match(state, /role="status"/);
    assert.match(state, /aria-hidden="true"/);
  });

  it("tells the person to keep the page open", () => {
    assert.match(state, /Please keep this page open/);
    assert.match(state, /A long document can take a minute or more/);
  });
});

describe("motion", () => {
  it("lets every spinner and pulse stand still when the system asks for less motion", () => {
    for (const file of ["../components/ui/LoadingState.tsx", "../app/loading.tsx"]) {
      const text = read(file);
      const animations = count(text, /\banimate-(spin|pulse|bounce)\b/g);
      const stillOnes = count(text, /motion-reduce:animate-none/g);
      assert.ok(animations > 0, file + " has no animation, so this check no longer tests anything");
      assert.equal(stillOnes, animations, file);
    }
  });
});

describe("error and not-found screens", () => {
  it("gives the error screen a message, a retry button and a way back to the start page", () => {
    const error = read("../app/error.tsx");
    assert.match(error, /Something went wrong/);
    assert.match(error, /Try again/);
    assert.match(error, /href="\/"/);
  });

  it("has a not-found screen in the style of the app, with a way back", () => {
    const notFound = read("../app/not-found.tsx");
    assert.match(notFound, /Page not found/);
    assert.match(notFound, /href="\/"/);
  });
});
