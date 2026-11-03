import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// "pnpm test" runs only the files that are named in package.json.
// A test file that is not named there would never run, and nobody would notice.

const script = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts.test;
const named = script.split(" ");

describe("the test script (package.json)", () => {
  it("runs every test file of the services and tests folders", () => {
    const files = [];
    for (const folder of ["services", "tests"]) {
      for (const name of readdirSync(new URL("../" + folder + "/", import.meta.url))) {
        if (name.endsWith(".test.mjs")) {
          files.push(folder + "/" + name);
        }
      }
    }

    assert.ok(files.length >= 10, "too few test files were found, so this check no longer tests anything");
    for (const file of files) {
      assert.ok(named.includes(file), file + " is not named in the test script of package.json");
    }
  });

  it("names only files that exist", () => {
    const files = named.filter((part) => part.endsWith(".mjs"));
    assert.ok(files.length >= 10, "too few files are named, so this check no longer tests anything");
    for (const file of files) {
      assert.ok(existsSync(new URL("../" + file, import.meta.url)), file + " is named in the test script but does not exist");
    }
  });
});
