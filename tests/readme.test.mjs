import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// These are simple text checks. They keep the README true to the code: the commands, the pages, the versions
// and the address of the server that it names must still exist, and nothing of the starter text may come back.
// Nothing here opens a page in a browser.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const readme = read("../README.md");
const api = read("../services/api.ts");
const layout = read("../app/layout.tsx");
const pkg = JSON.parse(read("../package.json"));

describe("README: the README of this project, with nothing left of the starter text", () => {
  it("starts with the title of this project, and has no other title of the first level", () => {
    assert.equal(readme.startsWith("# Legal Doc Analyzer - client\n"), true);
    assert.equal(count(readme, /^# /gm), 1);
  });

  it("has nothing left of the text that create-next-app writes", () => {
    for (const text of [
      "create-next-app",
      "## Getting Started",
      "## Learn More",
      "## Deploy on Vercel",
      "vercel.com",
      "Learn Next.js",
      "yarn dev",
      "bun dev",
      "auto-updates",
    ]) {
      assert.equal(readme.includes(text), false, "the README still has: " + text);
    }
  });

  it("has each section title once, and the sections that replace the starter text", () => {
    const titles = readme.match(/^## .+$/gm) || [];
    assert.ok(titles.length >= 11, "too few section titles were found: " + titles.length);
    assert.equal(new Set(titles).size, titles.length, "a section title is used twice");
    for (const title of ["## What it does", "## Quick start", "## Tried with a real AI service", "## Tests"]) {
      assert.equal(count(readme, new RegExp("^" + title + "$", "gm")), 1, title);
    }
  });

  it("says that the result is a first reading by a model and is not legal advice", () => {
    assert.match(readme, /It can miss a clause or get one wrong, and it is not legal advice\./);
  });
});

describe("README: the quick start names what exists", () => {
  it("names scripts of package.json, and the packages are installed with pnpm", () => {
    for (const name of ["dev", "build", "lint", "test"]) {
      assert.equal(typeof pkg.scripts[name], "string", "package.json has no script " + name);
    }
    assert.match(readme, /^1\. Start the server first: in the `server` folder, run `pnpm start:dev`\. It listens on port 3001\.$/m);
    assert.match(readme, /^2\. In the `client` folder, install the packages: `pnpm install`\.$/m);
    assert.match(readme, /^3\. Start the page: `pnpm dev`\.$/m);
    assert.match(readme, /^4\. Open http:\/\/localhost:3000 in a browser and upload a PDF or a Word file\.$/m);
    assert.match(readme, /Run `pnpm test`\./);
  });

  it("names the versions of Next.js, React and Tailwind CSS that package.json has", () => {
    assert.match(pkg.dependencies.next, /^16\./);
    assert.match(pkg.dependencies.react, /^19\./);
    assert.match(pkg.devDependencies.tailwindcss, /^\^?4/);
    assert.match(readme, /\[Next\.js\]\(https:\/\/nextjs\.org\) 16 \(App Router\), React 19 and Tailwind CSS 4/);
  });

  it("gives the default address of the server as services/api.ts has it, and names the setting that changes it", () => {
    const found = api.match(/export const DEFAULT_API_URL = "([^"]+)"/);
    assert.notEqual(found, null, "services/api.ts has no DEFAULT_API_URL");
    assert.ok(readme.includes("`" + found[1] + "`"), "the README does not name " + found[1]);
    assert.match(readme, /`NEXT_PUBLIC_API_URL`/);
    assert.match(readme, /`CLIENT_ORIGIN` setting of the server/);
  });

  it("names the three pages, their files and the labels of the navigation bar", () => {
    const pages = [
      ["/", "../app/page.tsx"],
      ["/dashboard", "../app/dashboard/page.tsx"],
      ["/documents/<id>", "../app/documents/[id]/page.tsx"],
    ];
    const section = readme.slice(readme.indexOf("## What it does"), readme.indexOf("## Quick start"));
    assert.ok(section.length > 100, "the section What it does was not found");
    for (const [route, file] of pages) {
      assert.equal(existsSync(new URL(file, import.meta.url)), true, file + " does not exist");
      assert.ok(section.includes("`" + route + "`"), "What it does does not name the page " + route);
    }
    for (const label of ["New Analysis", "Document History"]) {
      assert.ok(layout.includes(label), "the navigation bar has no label " + label);
      assert.ok(section.includes('"' + label + '"'), "What it does does not name the label " + label);
    }
  });

  it("says where the fonts come from, as the layout loads them", () => {
    assert.match(layout, /from "next\/font\/google"/);
    assert.match(readme, /through `next\/font\/google` \(`app\/layout\.tsx`\)/);
    assert.match(readme, /the browser sends no request to Google/);
    assert.match(readme, /What happens without one was not tried\./);
  });
});

describe("README: what was tried with a real AI service", () => {
  it("says what the live test of the server showed, and what it did not show", () => {
    assert.match(readme, /^## Tried with a real AI service$/m);
    assert.match(readme, /Ollama 0\.40\.13 and `qwen2\.5:7b`/);
    assert.match(readme, /That test called the server directly and did not use this page\./);
    assert.match(readme, /do not open a browser/);
    assert.match(readme, /The whole chain \(browser, server, Ollama\) was not run together for the stop\./);
  });

  it("no longer says that the stop was not tried with a real Ollama model", () => {
    assert.equal(readme.includes("was not tried with a real Ollama model"), false);
    assert.match(readme, /Ollama 0\.40\.13 with `qwen2\.5:7b` ended the question when the connection was closed\./);
  });

  it("is named in the test script of package.json", () => {
    assert.ok(pkg.scripts.test.split(" ").includes("tests/readme.test.mjs"));
  });
});
