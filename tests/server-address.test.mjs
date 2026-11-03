import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The address of the server can be set with NEXT_PUBLIC_API_URL. These checks keep services/api.ts, the other files that touch the address,
// and the description in the README in line with each other. services/apiAddress.test.mjs tests what the address does.
// Nothing here starts a browser or the server.

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

const api = read("services/api.ts");
// The code of services/api.ts without the lines that only hold a comment, so that a comment which names the setting is not counted.
const code = api
  .split("\n")
  .filter((line) => line.trim().startsWith("//") === false)
  .join("\n");
const readme = read("README.md");
const pkg = JSON.parse(read("package.json"));
const apiTest = read("services/api.test.mjs");
const savedPage = read("app/documents/[id]/page.tsx");

// The part of the README between the heading "Changing the server address" and the next heading.
function addressSection() {
  const start = readme.indexOf("## Changing the server address\n");
  assert.notEqual(start, -1, "the README has no section Changing the server address");
  const next = readme.indexOf("\n## ", start + 1);
  assert.notEqual(next, -1, "the section Changing the server address has no section after it");
  return readme.slice(start, next);
}

describe("services/api.ts: where the address comes from", () => {
  it("has the default address http://localhost:3001 once, as DEFAULT_API_URL, and no fixed address under the old name", () => {
    assert.equal(api.includes('export const DEFAULT_API_URL = "http://localhost:3001";'), true);
    assert.equal(api.match(/DEFAULT_API_URL = /g).length, 1);
    assert.doesNotMatch(api, /API_BASE_URL/);
  });

  it("reads the setting only as process.env.NEXT_PUBLIC_API_URL, the one form that Next.js replaces by the value", () => {
    assert.equal(code.match(/process\.env\.NEXT_PUBLIC_API_URL/g).length, 1);
    // Any other use of process.env (a copy, process.env[name], a destructuring) would not be replaced in the code for the browser.
    assert.equal(code.match(/process\.env/g).length, 1);
    assert.equal(code.includes("return process.env.NEXT_PUBLIC_API_URL;"), true);
  });

  it("reads the setting inside a function, so that it is read at the moment of the call", () => {
    assert.match(api, /function readSetting\(\): string \| undefined \{\n  try \{\n    return process\.env\.NEXT_PUBLIC_API_URL;\n  \} catch \{\n    return undefined;\n  \}\n\}/);
    assert.match(api, /function getApiBaseUrl\(\): string \{\n  return resolveApiBaseUrl\(readSetting\(\)\);\n\}/);
    assert.equal(/^const [A-Za-z_]+ = .*process\.env/m.test(code), false, "a constant at the top of the file would freeze the setting");
  });

  it("gives every fetch of the file the address from getApiBaseUrl(), once per function", () => {
    assert.equal(code.match(/fetch\(/g).length, 5);
    assert.equal(code.match(/fetch\(`\$\{baseUrl\}\//g).length, 5);
    assert.equal(code.match(/const baseUrl = getApiBaseUrl\(\);/g).length, 5);
    assert.equal(code.match(/getApiBaseUrl\(\)/g).length, 6, "five calls and the definition");
  });

  it("reads the address before the try block of fetch, so that a wrong setting is not told as an unreachable server", () => {
    assert.equal(
      api.match(/const baseUrl = getApiBaseUrl\(\);\n\n  let response: Response;\n  try \{/g).length,
      4,
      "analyzeDocument, listDocuments, deleteDocument and the question",
    );
    assert.match(api, /const baseUrl = getApiBaseUrl\(\);\n\n  const response = await fetch\(`\$\{baseUrl\}\/documents\/\$\{encodeURIComponent\(id\)\}`/);
  });

  it("names the address that was used in every message about a server that cannot be reached", () => {
    assert.equal(code.match(/Could not reach the server at \$\{baseUrl\}\./g).length, 4);
    assert.equal(code.match(/Could not reach the server at/g).length, 4);
  });

  it("refuses an address that has no http:// or https:// start, a user name, a password, a ? or a #", () => {
    assert.match(api, /url\.protocol !== "http:" && url\.protocol !== "https:"/);
    assert.match(api, /url\.username !== "" \|\| url\.password !== ""/);
    assert.match(api, /text\.includes\("\?"\) \|\| text\.includes\("#"\)/);
  });

  it("does not put the refused value into the message", () => {
    const start = api.indexOf("function badSetting(");
    assert.notEqual(start, -1);
    const body = api.slice(start, api.indexOf("\n}\n", start));
    assert.equal(/\$\{(text|setting|value)\}/.test(body), false);
  });
});

describe("the tests do not depend on a setting in the terminal", () => {
  it("clears the setting at the top of services/api.test.mjs, before the first test", () => {
    const clear = apiTest.search(/^delete process\.env\.NEXT_PUBLIC_API_URL;$/m);
    assert.notEqual(clear, -1);
    assert.equal(clear < apiTest.indexOf('describe("analyzeDocument"'), true);
  });

  it("lets services/api.test.mjs pass although the terminal has another address in NEXT_PUBLIC_API_URL", () => {
    // The child process gets the setting, and must not inherit the settings of this test run.
    const env = { ...process.env, NEXT_PUBLIC_API_URL: "http://other-host.example:9" };
    delete env.NODE_OPTIONS;
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["--test", "services/api.test.mjs"], { cwd: fileURLToPath(root), encoding: "utf8", env });
    assert.equal(run.status, 0, run.stdout + run.stderr);
  });

  it("names the two new test files in the test script", () => {
    const names = pkg.scripts.test.split(" ");
    assert.equal(names.includes("services/apiAddress.test.mjs"), true);
    assert.equal(names.includes("tests/server-address.test.mjs"), true);
  });
});

describe("the saved report page", () => {
  it("tells the person to check the address, not only the backend, when it cannot load the document", () => {
    assert.equal(
      savedPage.includes("Check that the backend is running and that the server address is right (see Changing the server address in the README), then reload this page."),
      true,
    );
  });
});

describe("README: the server address", () => {
  it("says in the quick start that the page finds the server at the default address unless another one is set", () => {
    assert.match(readme, /The page finds the server at `http:\/\/localhost:3001` unless you set another address \(see "Changing the server address" below\)\./);
    assert.doesNotMatch(readme, /That address is written in `services\/api\.ts`/);
    assert.doesNotMatch(readme, /you change that line/);
  });

  it("names the setting, an example with it, and the default address", () => {
    const section = addressSection();
    assert.match(section, /^The page calls the server at `http:\/\/localhost:3001`\. To use another address, set `NEXT_PUBLIC_API_URL` when you start the page, for example `NEXT_PUBLIC_API_URL=http:\/\/192\.168\.1\.20:3001 pnpm dev`\.$/m);
  });

  it("says which values are used and which are refused", () => {
    const section = addressSection();
    assert.match(section, /The address starts with `http:\/\/` or `https:\/\/`\. A slash at the end is removed\./);
    assert.match(section, /A path such as `https:\/\/example\.com\/api` is kept, and the calls are added after it\./);
    assert.match(section, /The address may not contain a user name, a password, a space, a line break, `\?` or `#`\./);
  });

  it("says that a setting which cannot be used is not replaced by the default, and where the message is seen", () => {
    const section = addressSection();
    assert.match(section, /When the setting is not there or is empty, the address stays `http:\/\/localhost:3001`\. A setting that cannot be used is not replaced by that address\./);
    assert.match(section, /Every call fails with a message that names `NEXT_PUBLIC_API_URL`, so a typo does not go unnoticed\./);
    assert.match(section, /The upload page and the History page show that message\. The saved report page shows its usual "Unable to load document" text, and the real message is written to the terminal where `pnpm dev` runs\./);
  });

  it("says when the value is taken, and that it is public", () => {
    const section = addressSection();
    assert.match(section, /Next\.js puts the value into the code of the page when it builds it\./);
    assert.match(section, /stop it and start it again after a change\./);
    assert.match(section, /For a build, give the setting to `pnpm build`, for example `NEXT_PUBLIC_API_URL=http:\/\/192\.168\.1\.20:3001 pnpm build`, and build again after a change\./);
    assert.match(section, /A page that was built earlier keeps the value it was built with\./);
    assert.doesNotMatch(section, /until you build it again/);
    assert.match(section, /The value is sent to the browser as part of the page, so it is not a place for a password\./);
  });

  it("says to give the setting to pnpm build and not only to pnpm start, and says what was tried and what comes from the build files", () => {
    const section = addressSection();
    assert.match(section, /Give the setting to `pnpm build`, not only to `pnpm start`\./);
    assert.equal(section.includes("were looked at (Next.js " + pkg.dependencies.next + "), a build made"), true);
    assert.match(section, /a build made without the setting had no reference to `NEXT_PUBLIC_API_URL` left in the code for the browser, but some of the code that runs on the computer of the page still read it when it runs\./);
    assert.match(section, /started with `NEXT_PUBLIC_API_URL=http:\/\/127\.0\.0\.1:1 pnpm start` showed that address on the History page, so a value given only to `pnpm start` does reach the History page\./);
    assert.match(section, /The saved report page asks the server from the same computer, so it most likely does the same\./);
    assert.match(section, /The upload, the Delete buttons and the question box run in the browser and most likely keep the default address, and then the pages use two addresses\./);
    assert.match(section, /Only the History page was tried, once, on one computer, with nothing listening at that address\. The rest comes from the build files\./);
    assert.doesNotMatch(section, /A running page was not tried\./);
  });

  it("says that the address must work from the computer that runs the page and from the browser, and names CLIENT_ORIGIN", () => {
    const section = addressSection();
    assert.match(section, /The History page and the saved report page ask the server from the computer that runs the page\. The upload, the Delete buttons and the question box ask it from the browser\. The address must work from both\./);
    assert.match(section, /`localhost` always means the computer that makes the call\./);
    assert.match(section, /`CLIENT_ORIGIN` setting \(http:\/\/localhost:3000 by default\)/);
    assert.match(section, /This client does not change the server\./);
  });

  it("says where else Next.js reads the setting, that the terminal wins, and that no file is created", () => {
    const section = addressSection();
    assert.match(section, /A value set in the terminal wins over a file\./);
    assert.match(section, /`\.env\.local` in the `client` folder/);
    assert.match(section, /This project does not create that file\./);
  });

  it("names the tests, and says what was not tried", () => {
    const section = addressSection();
    assert.match(section, /`pnpm test` does not depend on the setting, because `services\/api\.test\.mjs` clears it first\./);
    assert.match(section, /`services\/apiAddress\.test\.mjs` and `tests\/server-address\.test\.mjs` test the address and keep this text in line with the code\./);
    assert.match(section, /Not tried: a running page with a server at another address, the saved report page when the value is given only to `pnpm start`, and the upload, the Delete buttons and the question box in a browser\. The tests use a stand-in for the network\./);
  });

  it("is listed before the backend endpoints, and the endpoints say that the address is the default one", () => {
    assert.equal(readme.indexOf("## Changing the server address") < readme.indexOf("## Backend endpoints this client expects"), true);
    assert.match(readme, /The client talks to the NestJS server at http:\/\/localhost:3001 by default \(see "Changing the server address" above and `services\/api\.ts`\)\./);
  });

  it("describes the two new test files in the paragraph about the tests", () => {
    const paragraph = readme.slice(readme.lastIndexOf("Run `pnpm test`."));
    assert.match(paragraph, /`services\/apiAddress\.test\.mjs` tests the rules for the address and that every call uses it\./);
    assert.match(paragraph, /`tests\/server-address\.test\.mjs` keeps the code and the text about the address in line with each other\./);
  });
});
