import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// The address of the server can be set with the setting NEXT_PUBLIC_API_URL (see "Changing the server address" in the README).
// These tests set it with process.env, call the functions of services/api.ts with a stand-in for fetch, and look at the address that fetch got.
// Nothing here starts the server or a browser.

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const {
  DEFAULT_API_URL,
  analyzeDocument,
  askDocumentQuestion,
  deleteDocument,
  getDocumentById,
  listDocuments,
  resolveApiBaseUrl,
} = await import("./api.ts");

const { File } = globalThis;

const SETTING = "NEXT_PUBLIC_API_URL";
const NBSP = String.fromCharCode(160);
const realFetch = globalThis.fetch;
const realSetting = process.env[SETTING];
let calls = [];

// Answers every call with the given status and body, and remembers the address of each call.
function stubFetch(status, body) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options });
    return {
      status: status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    };
  };
}

// Makes every call fail like a network that is down.
function stubNetworkDown() {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options: options });
    throw new TypeError("fetch failed");
  };
}

function setSetting(value) {
  if (value === undefined) {
    delete process.env[SETTING];
  } else {
    process.env[SETTING] = value;
  }
}

// The five calls of services/api.ts, each with the answer that makes it succeed and the path it must call.
const analysis = { documentName: "NDA.pdf", executiveSummary: "Short summary.", clauses: [] };
const CALLS = [
  { name: "analyzeDocument", status: 200, body: analysis, path: "/analyze", run: () => analyzeDocument(new File(["x"], "a.pdf")) },
  { name: "listDocuments", status: 200, body: { documents: [], total: 0, unreadable: 0 }, path: "/documents", run: () => listDocuments() },
  { name: "getDocumentById", status: 200, body: analysis, path: "/documents/doc_1", run: () => getDocumentById("doc_1") },
  { name: "deleteDocument", status: 204, body: null, path: "/documents/doc_1", run: () => deleteDocument("doc_1") },
  { name: "askDocumentQuestion", status: 200, body: { answer: "Yes." }, path: "/documents/doc_1/ask", run: () => askDocumentQuestion("doc_1", "Is it fair?", []) },
];

describe("resolveApiBaseUrl: no setting", () => {
  it("gives http://localhost:3001 as the default address", () => {
    assert.equal(DEFAULT_API_URL, "http://localhost:3001");
  });

  it("gives the default address when the setting is missing", () => {
    assert.equal(resolveApiBaseUrl(undefined), DEFAULT_API_URL);
  });

  it("gives the default address when the setting is empty or only spaces", () => {
    for (const value of ["", " ", "   ", "\n", "\t", " \n\t ", NBSP]) {
      assert.equal(resolveApiBaseUrl(value), DEFAULT_API_URL, JSON.stringify(value));
    }
  });
});

describe("resolveApiBaseUrl: values that are used", () => {
  const USED = [
    ["http://localhost:3001", "http://localhost:3001"],
    ["http://localhost:3001/", "http://localhost:3001"],
    ["http://localhost:3001///", "http://localhost:3001"],
    ["  http://localhost:3001  ", "http://localhost:3001"],
    ["\nhttp://localhost:3001\n", "http://localhost:3001"],
    [NBSP + "http://localhost:3001" + NBSP, "http://localhost:3001"],
    ["http://localhost", "http://localhost"],
    ["https://api.example.com", "https://api.example.com"],
    ["https://api.example.com/", "https://api.example.com"],
    ["http://192.168.1.20:4000", "http://192.168.1.20:4000"],
    ["http://[::1]:3001", "http://[::1]:3001"],
    ["HTTP://LOCALHOST:3001", "http://localhost:3001"],
    ["http://example.com:80/", "http://example.com"],
    ["https://example.com:443", "https://example.com"],
    ["https://api.example.com/api", "https://api.example.com/api"],
    ["https://api.example.com/api/", "https://api.example.com/api"],
    ["https://api.example.com/api/v1//", "https://api.example.com/api/v1"],
  ];

  for (const [setting, expected] of USED) {
    it("turns " + JSON.stringify(setting) + " into " + JSON.stringify(expected), () => {
      assert.equal(resolveApiBaseUrl(setting), expected);
    });
  }

  it("never ends with a slash, so that a path can be added after it", () => {
    for (const [setting] of USED) {
      const address = resolveApiBaseUrl(setting);
      assert.equal(address.endsWith("/"), false, address);
      assert.equal(new URL(address + "/documents").pathname.endsWith("/documents"), true, address);
    }
  });
});

describe("resolveApiBaseUrl: values that are refused", () => {
  const START = /^The server address in NEXT_PUBLIC_API_URL is not valid\. Write it like http:\/\/localhost:3001, starting with http:\/\/ or https:\/\/\. Change the setting, then start the page again\.$/;
  const WRONG_START = [
    "localhost:3001",
    "127.0.0.1:3001",
    "localhost",
    "//localhost:3001",
    "ftp://localhost:3001",
    "ws://localhost:3001",
    "file:///tmp/server",
    "javascript:alert(1)",
    "notanaddress",
    "http://",
    "https://",
    "http:",
    "  localhost:3001  ",
  ];

  for (const setting of WRONG_START) {
    it("refuses " + JSON.stringify(setting) + " and says how to write the address", () => {
      assert.throws(() => resolveApiBaseUrl(setting), (error) => error instanceof Error && START.test(error.message));
    });
  }

  it("refuses a space or a line break inside the address", () => {
    for (const setting of ["http://local host:3001", "not an address", "http://localhost:3001 /api", "http://local\thost:3001", "http://local\nhost:3001", "http://localhost:3001" + NBSP + "/api"]) {
      assert.throws(
        () => resolveApiBaseUrl(setting),
        { message: "The server address in NEXT_PUBLIC_API_URL is not valid. It must not contain spaces or line breaks. Change the setting, then start the page again." },
        JSON.stringify(setting),
      );
    }
  });

  it("refuses a user name or a password, and does not repeat them in the message", () => {
    for (const setting of ["http://user:secret@localhost:3001", "http://user@localhost:3001", "http://:secret@localhost:3001", "https://user:@example.com"]) {
      assert.throws(
        () => resolveApiBaseUrl(setting),
        (error) =>
          error instanceof Error &&
          error.message === "The server address in NEXT_PUBLIC_API_URL is not valid. It must not contain a user name or a password. Change the setting, then start the page again." &&
          error.message.includes("secret") === false,
        setting,
      );
    }
  });

  it("refuses a ? or a # in the address", () => {
    for (const setting of ["http://localhost:3001?x=1", "http://localhost:3001/?", "http://localhost:3001#top", "http://localhost:3001/#", "https://example.com/api?key=1"]) {
      assert.throws(
        () => resolveApiBaseUrl(setting),
        { message: "The server address in NEXT_PUBLIC_API_URL is not valid. It must not contain a ? or a #. Change the setting, then start the page again." },
        setting,
      );
    }
  });

  it("does not repeat a refused value in the message", () => {
    assert.throws(
      () => resolveApiBaseUrl("my-private-host:9"),
      (error) => error instanceof Error && error.message.includes("my-private-host") === false,
    );
  });
});

describe("the calls use the address of the setting", () => {
  beforeEach(() => {
    calls = [];
    setSetting(undefined);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    setSetting(realSetting);
  });

  for (const call of CALLS) {
    it(call.name + " calls the default address when there is no setting", async () => {
      stubFetch(call.status, call.body);
      await call.run();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "http://localhost:3001" + call.path);
    });

    it(call.name + " calls the default address when the setting is empty", async () => {
      setSetting("   ");
      stubFetch(call.status, call.body);
      await call.run();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "http://localhost:3001" + call.path);
    });

    it(call.name + " calls the address of the setting, without a double slash", async () => {
      setSetting("https://api.example.com/v1/");
      stubFetch(call.status, call.body);
      await call.run();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.example.com/v1" + call.path);
    });

    it(call.name + " does not call anything, and says what is wrong, when the setting cannot be used", async () => {
      setSetting("localhost:3001");
      stubFetch(call.status, call.body);
      await assert.rejects(call.run, /^Error: The server address in NEXT_PUBLIC_API_URL is not valid\. Write it like http:\/\/localhost:3001, starting with http:\/\/ or https:\/\/\. Change the setting, then start the page again\.$/);
      assert.equal(calls.length, 0);
    });
  }

  it("reads the setting at the moment of the call, not once when the file is loaded", async () => {
    stubFetch(200, { documents: [], total: 0, unreadable: 0 });
    setSetting("http://first.example:1111");
    await listDocuments();
    setSetting("http://second.example:2222");
    await listDocuments();
    setSetting(undefined);
    await listDocuments();
    assert.deepEqual(
      calls.map((call) => call.url),
      ["http://first.example:1111/documents", "http://second.example:2222/documents", "http://localhost:3001/documents"],
    );
  });

  it("keeps the rest of each call as it was: method, body and the encoded id", async () => {
    setSetting("http://192.168.1.20:4000");
    stubFetch(204, null);
    await deleteDocument("a/b?c");
    assert.equal(calls[0].url, "http://192.168.1.20:4000/documents/a%2Fb%3Fc");
    assert.equal(calls[0].options.method, "DELETE");

    calls = [];
    stubFetch(200, { answer: "Yes." });
    await askDocumentQuestion("a/b?c", "Is it fair?", []);
    assert.equal(calls[0].url, "http://192.168.1.20:4000/documents/a%2Fb%3Fc/ask");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(JSON.parse(calls[0].options.body).question, "Is it fair?");
  });
});

describe("the message when the server cannot be reached names the address that was used", () => {
  beforeEach(() => {
    calls = [];
    setSetting("http://192.168.1.20:4000/");
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    setSetting(realSetting);
  });

  it("analyzeDocument names the address", async () => {
    stubNetworkDown();
    await assert.rejects(() => analyzeDocument(new File(["x"], "a.pdf")), {
      message: "Could not reach the server at http://192.168.1.20:4000. Check that the backend is running, then try again.",
    });
  });

  it("listDocuments names the address", async () => {
    stubNetworkDown();
    await assert.rejects(() => listDocuments(), {
      message: "Could not reach the server at http://192.168.1.20:4000. Check that the backend is running.",
    });
  });

  it("deleteDocument names the address", async () => {
    stubNetworkDown();
    await assert.rejects(() => deleteDocument("doc_1"), {
      message: "Could not reach the server at http://192.168.1.20:4000. Check that the backend is running, then try again.",
    });
  });

  it("askDocumentQuestion names the address", async () => {
    stubNetworkDown();
    await assert.rejects(() => askDocumentQuestion("doc_1", "Is it fair?", []), {
      message: "Could not reach the server at http://192.168.1.20:4000. Check that the backend is running, then try again.",
    });
  });
});

describe("a page without a process object, as a browser has when the build did not replace the setting", () => {
  beforeEach(() => {
    calls = [];
    setSetting(undefined);
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    setSetting(realSetting);
  });

  // Every call reads the setting before its first await, so process can be taken away just while the call starts.
  // "removed" gives a ReferenceError, which is what a browser gives. "undefined" gives a TypeError.
  function startWithoutProcess(start, how) {
    const realProcess = globalThis.process;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "process");
    let promise;
    try {
      if (how === "removed") {
        delete globalThis.process;
      } else {
        globalThis.process = undefined;
      }
      promise = start();
    } finally {
      // In Node, process is an accessor that keeps its value in a variable of its own, so the value is set again after the property is back.
      Object.defineProperty(globalThis, "process", descriptor);
      globalThis.process = realProcess;
    }
    return promise;
  }

  for (const call of CALLS) {
    for (const how of ["removed", "undefined"]) {
      it(call.name + " calls the default address when process is " + how, async () => {
        stubFetch(call.status, call.body);
        await startWithoutProcess(call.run, how);
        assert.equal(typeof process, "object", "process must be back");
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, "http://localhost:3001" + call.path);
      });
    }
  }

  it("still refuses a setting that cannot be used, when process is there", async () => {
    setSetting("localhost:3001");
    stubFetch(200, { documents: [], total: 0, unreadable: 0 });
    await assert.rejects(() => listDocuments(), /is not valid/);
    assert.equal(calls.length, 0);
  });
});
