import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// These are simple text checks. They keep the component LocalTime, the two places that use it and the README in line with each other.
// What the time looks like in each time zone is tested in services/history.test.mjs. Nothing here opens a browser.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const count = (text, pattern) => (text.match(pattern) || []).length;

const component = read("../components/document/LocalTime.tsx");
const dashboard = read("../app/dashboard/page.tsx");
const results = read("../components/document/AnalysisResults.tsx");
const readme = read("../README.md");
const pkg = JSON.parse(read("../package.json"));

// Every .ts and .tsx file of the pages, the components and the services, as a list of [path, text].
function sourceFiles() {
  const files = [];
  for (const folder of ["../app/", "../components/", "../services/"]) {
    for (const name of readdirSync(new URL(folder, import.meta.url), { recursive: true })) {
      if (/\.tsx?$/.test(String(name))) {
        files.push([folder + String(name), read(folder + String(name))]);
      }
    }
  }
  return files;
}

describe("LocalTime (components/document/LocalTime.tsx)", () => {
  it("is a client component, because the time zone is only known in the browser", () => {
    assert.match(component, /^"use client";/);
  });

  it("gives the server and the first draw of the browser the UTC text, and the browser then the local text", () => {
    assert.match(component, /import \{ useSyncExternalStore \} from "react";/);
    assert.match(component, /import \{ formatLocalTime, formatSavedAt \} from "@\/services\/history";/);
    assert.match(component, /const utcText = formatSavedAt\(value\);/);
    assert.match(component, /useSyncExternalStore\(\s*subscribe,\s*\(\) => formatLocalTime\(value\),\s*\(\) => utcText,\s*\)/);
    assert.equal(count(component, /useSyncExternalStore\(/g), 1);
  });

  it("has nothing to listen to, because the time zone does not change while the page is open", () => {
    assert.match(component, /function subscribe\(\): \(\) => void \{\s*return \(\) => undefined;\s*\}/);
  });

  it("uses no state and no effect, and does not read the clock", () => {
    assert.doesNotMatch(component, /useState|useEffect|useLayoutEffect|setTimeout|setInterval/);
    assert.doesNotMatch(component, /Date\.now|new Date/);
  });

  it("puts the time in a time element, with the time of the server as dateTime and the UTC text as the title", () => {
    assert.match(component, /<time dateTime=\{value\} title=\{utcText !== null && utcText !== text \? utcText : undefined\}>\s*\{text\}\s*<\/time>/);
  });

  it("shows the fallback text, or nothing, when the value is not a usable time", () => {
    assert.match(component, /if \(text === null\) \{\s*return fallback === undefined \? null : <>\{fallback\}<\/>;\s*\}/);
    assert.ok(component.indexOf("useSyncExternalStore(") < component.indexOf("if (text === null)"), "the hook must come before the early return");
    const beforeHook = component.slice(component.indexOf("export default function LocalTime"), component.indexOf("useSyncExternalStore("));
    assert.doesNotMatch(beforeHook, /\breturn\b/, "nothing may return before the hook is called");
  });

  it("does not format the time itself, and does not use the language of the browser", () => {
    assert.doesNotMatch(component, /toLocale|Intl\.|getTimezoneOffset|getHours|getUTC/);
  });

  it("uses no dark mode colours and sets no colours of its own", () => {
    assert.doesNotMatch(component, /\bdark:|className/);
  });
});

describe("the pages that show a time", () => {
  it("History page: the small component SavedTime uses LocalTime and says Unknown date for a time that cannot be used", () => {
    assert.match(dashboard, /import LocalTime from "@\/components\/document\/LocalTime";/);
    assert.match(dashboard, /function SavedTime\(\{ value \}: \{ value: string \}\) \{\s*return <LocalTime value=\{value\} fallback="Unknown date" \/>;\s*\}/);
    assert.equal(count(dashboard, /<SavedTime value=\{doc\.savedAt\} \/>/g), 2);
    assert.doesNotMatch(dashboard, /formatSavedAt|toLocale|<time/);
  });

  it("saved page and results: the Saved text uses LocalTime, and only for a time that can be used", () => {
    assert.match(results, /import LocalTime from "@\/components\/document\/LocalTime";/);
    assert.match(results, /const savedAt = formatSavedAt\(data\.savedAt\) === null \? undefined : data\.savedAt;/);
    assert.match(results, /\{savedAt === undefined \? null : <> &middot; Saved <LocalTime value=\{savedAt\} \/><\/>\}/);
    assert.doesNotMatch(results, /toLocale|<time/);
  });

  it("only these two files use LocalTime, and no other file works out a time of the clock", () => {
    const files = sourceFiles();
    const users = files.filter(([, text]) => text.includes('from "@/components/document/LocalTime"')).map(([path]) => path).sort();
    assert.deepEqual(users, ["../app/dashboard/page.tsx", "../components/document/AnalysisResults.tsx"]);
    const clockUsers = files.filter(([, text]) => /toLocale|getTimezoneOffset|Intl\.DateTimeFormat/.test(text)).map(([path]) => path);
    assert.deepEqual(clockUsers, ["../services/history.ts"]);
  });
});

describe("README: times", () => {
  it("says that times are shown on the clock of the computer, with the difference to UTC", () => {
    assert.match(readme, /Times are shown on the clock of your computer, with the difference to UTC, for example "25 Oct 2026, 17:30 UTC\+1"/);
    assert.match(readme, /a computer set to UTC shows "25 Oct 2026, 16:30 UTC"/);
  });

  it("says where the work is done", () => {
    assert.match(readme, /`formatLocalTime` in `services\/history\.ts`, shown by `components\/document\/LocalTime\.tsx`/);
    assert.match(readme, /The server saves each time in UTC \(`savedAt`, such as 2026-10-25T16:30:00\.000Z\)/);
  });

  it("says what the page shows first, that the UTC time can be seen for a moment, and the hover text", () => {
    assert.match(readme, /the page it sends first shows the time in UTC \(`formatSavedAt`\), and the browser replaces it with the local time as soon as the page is ready/);
    assert.match(readme, /For a moment the UTC time can be seen/);
    assert.match(readme, /shows the UTC time when you hover over it/);
  });

  it("says that the time zone is not sent or stored, and that the page follows what the browser reports", () => {
    assert.match(readme, /Your time zone is not sent to the server and not stored\./);
    assert.match(readme, /follows what the browser reports/);
  });

  it("says that the Saved time under the title works in the same way", () => {
    assert.match(readme, /The same is true of the "Saved" time under the title of a new or a saved analysis\./);
    assert.match(readme, /for example "Saved 25 Oct 2026, 17:30 UTC\+1" \(the time is written as described for the History page below\)/);
  });

  it("says what the tests do and do not do", () => {
    assert.match(readme, /The tests set several time zones in Node, among them half-hour zones and the days when the clocks change, but they do not open a browser\./);
  });

  it("no longer says that times are always in UTC and not changed", () => {
    assert.equal(readme.includes("They are not changed to your time zone."), false);
    assert.equal(readme.includes("so that the server and the browser always show the same text"), false);
    assert.equal(readme.includes('for example "Saved 25 Oct 2026, 16:30 UTC"'), false);
  });

  it("is named in the test script of package.json", () => {
    assert.ok(pkg.scripts.test.split(" ").includes("tests/local-time.test.mjs"));
  });
});
