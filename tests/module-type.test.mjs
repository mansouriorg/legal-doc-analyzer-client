import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

// package.json says "type": "module". Without that line, Node reads each .ts file that a test imports as an old-style (CommonJS) file first,
// cannot parse it, reads it again as an ES module, and prints a warning for it (MODULE_TYPELESS_PACKAGE_JSON).
// These checks keep the line in place, and keep the project free of the old-style code that the line would break.
// Nothing here starts a browser or the server.

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const readme = readFileSync(new URL("README.md", root), "utf8");

const SKIPPED_FOLDERS = ["node_modules", ".next", ".update-backup", "out", "build", "coverage"];
const SOURCE_FOLDERS = ["app", "components", "services", "tests", "types"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs"];

// Every file under a folder of the project, without the folders that hold built or copied files.
function filesUnder(folder) {
  const found = [];
  for (const entry of readdirSync(new URL(folder + "/", root), { withFileTypes: true })) {
    if (SKIPPED_FOLDERS.includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      found.push(...filesUnder(folder + "/" + entry.name));
    } else {
      found.push(folder + "/" + entry.name);
    }
  }

  return found;
}

// The names of the old-style code are put together from parts, so that this file does not contain them itself.
const word = (name, rest) => new RegExp("\\b" + name + rest);
const OLD_STYLE = [
  ["a call of the old import function", word("require", "\\(")],
  ["the old export object", word("module", "\\.exports")],
  ["the old folder name", word("__dir" + "name", "\\b")],
  ["the old file name", word("__file" + "name", "\\b")],
];

function sourceFiles() {
  const files = [];
  for (const folder of SOURCE_FOLDERS) {
    if (existsSync(new URL(folder + "/", root))) {
      files.push(...filesUnder(folder));
    }
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile()) {
      files.push(entry.name);
    }
  }

  return files.filter((file) => SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension)));
}

describe("module type (package.json)", () => {
  it("says type module, so that the files of the project are read as ES modules", () => {
    assert.equal(pkg.type, "module");
  });

  it("does not hide the warning in the test script: the script is plain node --test", () => {
    assert.match(pkg.scripts.test, /^node --test /);
    assert.doesNotMatch(pkg.scripts.test, /--disable-warning|--no-warnings|NODE_OPTIONS/);
  });

  it("makes Node print no module type warning for the files in services that the tests import", () => {
    const names = readdirSync(new URL("services/", root)).filter((name) => name.endsWith(".ts") && name.endsWith(".d.ts") === false);
    assert.ok(names.length >= 5, "too few files were found, so this check no longer tests anything");
    const urls = names.map((name) => new URL("services/" + name, root).href);

    // The child process must not inherit settings that could hide a warning or change how Node starts.
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", "for (const url of " + JSON.stringify(urls) + ") { await import(url); }"], { encoding: "utf8", env });

    assert.equal(run.status, 0, "the files could not be imported:\n" + run.stderr);
    assert.doesNotMatch(run.stderr, /MODULE_TYPELESS_PACKAGE_JSON/);
  });
});

describe("the project has no old-style code that type module would break", () => {
  it("has no .js file, which type module would make an ES module", () => {
    const found = [];
    for (const folder of SOURCE_FOLDERS) {
      if (existsSync(new URL(folder + "/", root))) {
        found.push(...filesUnder(folder).filter((file) => file.endsWith(".js") || file.endsWith(".jsx")));
      }
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".jsx"))) {
        found.push(entry.name);
      }
    }

    assert.deepEqual(found, [], "name a file that needs old-style code with the extension .cjs, and write the others as ES modules");
  });

  it("has no old-style code in the source files of the app, the components, the services, the tests and the types, or in the files at the top", () => {
    const files = sourceFiles();
    assert.ok(files.length >= 30, "too few files were found, so this check no longer tests anything");
    for (const file of files) {
      const text = readFileSync(new URL(file, root), "utf8");
      for (const [label, pattern] of OLD_STYLE) {
        assert.equal(pattern.test(text), false, file + " has " + label);
      }
    }
  });

  it("writes the three configuration files as ES modules: next.config.ts, postcss.config.mjs and eslint.config.mjs", () => {
    for (const file of ["next.config.ts", "postcss.config.mjs", "eslint.config.mjs"]) {
      assert.ok(existsSync(new URL(file, root)), file + " does not exist");
      assert.match(readFileSync(new URL(file, root), "utf8"), /^export default /m, file);
    }
  });
});

describe("README: the module type", () => {
  it("says what the setting does for the tests, that the old style needs the extension .cjs, and which test keeps it", () => {
    assert.match(readme, /`package\.json` has `"type": "module"`, so Node reads the `\.ts` files that the tests import as ES modules and prints no warning about them\./);
    assert.match(readme, /A file that needs the old `require` style must be named `\.cjs`\./);
    assert.match(readme, /`tests\/module-type\.test\.mjs` keeps that setting in place and checks that the project has no code of that old style\./);
  });

  it("is named in the test script of package.json", () => {
    assert.ok(pkg.scripts.test.split(" ").includes("tests/module-type.test.mjs"));
  });
});
