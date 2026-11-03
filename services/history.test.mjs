import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const { describeFilterResult, filterHistory, formatLocalTime, formatSavedAt, isFiltering, readHistoryFilter, reportPath, riskBadges, searchScopeNote, summarizeHistory } = await import("./history.ts");

// Read from globalThis so lint rules about undefined globals stay quiet.
const nodeProcess = globalThis.process;

function row(overrides) {
  return {
    id: "a1",
    documentName: "NDA.pdf",
    savedAt: "2026-10-25T16:30:00.000Z",
    clauseCount: 0,
    highRisks: 0,
    mediumRisks: 0,
    lowRisks: 0,
    ...overrides,
  };
}

describe("formatSavedAt", () => {
  it("writes a time of the server as day, month, year, hour and minute in UTC", () => {
    assert.equal(formatSavedAt("2026-10-25T16:30:00.000Z"), "25 Oct 2026, 16:30 UTC");
  });

  it("writes a one-digit day without a zero and the hour and the minute with two digits", () => {
    assert.equal(formatSavedAt("2026-01-05T04:07:00.000Z"), "5 Jan 2026, 04:07 UTC");
    assert.equal(formatSavedAt("2026-12-31T23:59:59.999Z"), "31 Dec 2026, 23:59 UTC");
    assert.equal(formatSavedAt("2026-03-01T00:00:00Z"), "1 Mar 2026, 00:00 UTC");
  });

  it("uses the right short name for every month", () => {
    const names = [];
    for (let month = 1; month <= 12; month += 1) {
      const text = formatSavedAt(`2026-${String(month).padStart(2, "0")}-15T12:00:00Z`);
      names.push(text.split(" ")[1]);
    }
    assert.deepEqual(names, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  });

  it("changes a time with another zone to UTC, also when the day changes", () => {
    assert.equal(formatSavedAt("2026-10-25T18:30:00+02:00"), "25 Oct 2026, 16:30 UTC");
    assert.equal(formatSavedAt("2026-10-25T23:30:00-03:00"), "26 Oct 2026, 02:30 UTC");
    assert.equal(formatSavedAt("2026-01-01T00:30:00+01:00"), "31 Dec 2025, 23:30 UTC");
  });

  it("accepts a time without seconds", () => {
    assert.equal(formatSavedAt("2026-10-25T16:30Z"), "25 Oct 2026, 16:30 UTC");
  });

  it("gives the same text in every time zone of the computer", () => {
    const before = nodeProcess.env.TZ;
    try {
      const texts = new Set();
      for (const zone of ["UTC", "Pacific/Auckland", "America/Los_Angeles", "Asia/Kolkata"]) {
        nodeProcess.env.TZ = zone;
        texts.add(formatSavedAt("2026-10-25T23:45:00.000Z"));
      }
      assert.deepEqual([...texts], ["25 Oct 2026, 23:45 UTC"]);
    } finally {
      if (before === undefined) {
        delete nodeProcess.env.TZ;
      } else {
        nodeProcess.env.TZ = before;
      }
    }
  });

  it("gives null for a text that is not a time with a zone", () => {
    const wrong = [
      "",
      "yesterday",
      "10/25/2026",
      "25 Oct 2026",
      "2026-10-25",
      "2026-10-25T16:30:00", // no zone: a browser would read it in its own time zone
      "2026-10-25 16:30:00Z",
      "2026-13-45T99:99:00Z",
      "2026-10-25T16:30:00.000Z extra",
    ];
    for (const value of wrong) {
      assert.equal(formatSavedAt(value), null, JSON.stringify(value));
    }
  });

  it("gives null for a value that is not text", () => {
    for (const value of [undefined, null, 0, 1761409800000, {}, [], true]) {
      assert.equal(formatSavedAt(value), null);
    }
  });
});

// Runs a function with another time zone for this process, and puts the old zone back afterwards.
function inZone(zone, run) {
  const before = nodeProcess.env.TZ;
  try {
    nodeProcess.env.TZ = zone;
    return run();
  } finally {
    if (before === undefined) {
      delete nodeProcess.env.TZ;
    } else {
      nodeProcess.env.TZ = before;
    }
  }
}

describe("formatLocalTime", () => {
  it("writes the time on the clock of the computer, with the difference to UTC", () => {
    const moment = "2026-10-25T16:30:00.000Z";
    const expected = [
      ["UTC", "25 Oct 2026, 16:30 UTC"],
      ["Africa/Tunis", "25 Oct 2026, 17:30 UTC+1"],
      ["America/New_York", "25 Oct 2026, 12:30 UTC-4"],
      ["America/Los_Angeles", "25 Oct 2026, 09:30 UTC-7"],
    ];
    for (const [zone, text] of expected) {
      assert.equal(inZone(zone, () => formatLocalTime(moment)), text, zone);
    }
  });

  it("writes a difference of a half hour or three quarters of an hour, also below zero", () => {
    const moment = "2026-10-25T16:30:00.000Z";
    assert.equal(inZone("Asia/Kolkata", () => formatLocalTime(moment)), "25 Oct 2026, 22:00 UTC+5:30");
    assert.equal(inZone("Asia/Kathmandu", () => formatLocalTime(moment)), "25 Oct 2026, 22:15 UTC+5:45");
    assert.equal(inZone("America/St_Johns", () => formatLocalTime(moment)), "25 Oct 2026, 14:00 UTC-2:30");
  });

  it("moves to the next day when the local time is past midnight, also at the end of the year", () => {
    assert.equal(inZone("Pacific/Auckland", () => formatLocalTime("2026-10-25T16:30:00.000Z")), "26 Oct 2026, 05:30 UTC+13");
    assert.equal(inZone("Pacific/Kiritimati", () => formatLocalTime("2026-10-25T16:30:00.000Z")), "26 Oct 2026, 06:30 UTC+14");
    assert.equal(inZone("Africa/Tunis", () => formatLocalTime("2026-12-31T23:30:00Z")), "1 Jan 2027, 00:30 UTC+1");
  });

  it("moves to the day before when the local time is before midnight, also at the start of the year", () => {
    assert.equal(inZone("America/Los_Angeles", () => formatLocalTime("2026-01-01T00:30:00Z")), "31 Dec 2025, 16:30 UTC-8");
    assert.equal(inZone("America/New_York", () => formatLocalTime("2026-03-01T02:05:00Z")), "28 Feb 2026, 21:05 UTC-5");
  });

  it("uses the difference of that moment, so a place with summer time has a different difference in winter and summer", () => {
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-01-15T12:00:00Z")), "15 Jan 2026, 13:00 UTC+1");
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-07-15T12:00:00Z")), "15 Jul 2026, 14:00 UTC+2");
    assert.equal(inZone("America/New_York", () => formatLocalTime("2026-01-15T12:00:00Z")), "15 Jan 2026, 07:00 UTC-5");
    assert.equal(inZone("America/New_York", () => formatLocalTime("2026-07-15T12:00:00Z")), "15 Jul 2026, 08:00 UTC-4");
  });

  it("changes the difference at the minute when the clocks change", () => {
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-03-29T00:59:00Z")), "29 Mar 2026, 01:59 UTC+1");
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-03-29T01:00:00Z")), "29 Mar 2026, 03:00 UTC+2");
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-10-25T00:59:00Z")), "25 Oct 2026, 02:59 UTC+2");
    assert.equal(inZone("Europe/Paris", () => formatLocalTime("2026-10-25T01:00:00Z")), "25 Oct 2026, 02:00 UTC+1");
  });

  it("writes a one-digit day without a zero and the hour and the minute with two digits", () => {
    assert.equal(inZone("UTC", () => formatLocalTime("2026-01-05T04:07:00.000Z")), "5 Jan 2026, 04:07 UTC");
    assert.equal(inZone("Africa/Tunis", () => formatLocalTime("2026-03-01T00:00:00Z")), "1 Mar 2026, 01:00 UTC+1");
  });

  it("reads a time with another zone in the same way, and a time without seconds", () => {
    assert.equal(inZone("Africa/Tunis", () => formatLocalTime("2026-10-25T18:30:00+02:00")), "25 Oct 2026, 17:30 UTC+1");
    assert.equal(inZone("Africa/Tunis", () => formatLocalTime("2026-10-25T16:30Z")), "25 Oct 2026, 17:30 UTC+1");
  });

  it("is the same moment as formatSavedAt in every zone: the local text minus its difference gives the UTC text", () => {
    const zones = ["UTC", "Africa/Tunis", "Europe/Paris", "America/New_York", "America/St_Johns", "Asia/Kolkata", "Asia/Kathmandu", "Pacific/Auckland", "Pacific/Kiritimati", "America/Los_Angeles"];
    const moments = ["2026-01-01T00:00:00Z", "2026-03-29T01:00:00Z", "2026-06-30T23:59:00Z", "2026-10-25T01:00:00Z", "2026-11-01T06:00:00Z", "2026-12-31T23:59:00Z"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const zone of zones) {
      for (const moment of moments) {
        const text = inZone(zone, () => formatLocalTime(moment));
        const parts = text.match(/^(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2}) UTC(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
        assert.ok(parts !== null, zone + " " + moment + ": " + text);
        const local = Date.UTC(Number(parts[3]), months.indexOf(parts[2]), Number(parts[1]), Number(parts[4]), Number(parts[5]));
        const difference = parts[6] === undefined ? 0 : (parts[6] === "-" ? -1 : 1) * (Number(parts[7]) * 60 + Number(parts[8] ?? 0));
        assert.equal(new Date(local - difference * 60000).toISOString().slice(0, 16), new Date(moment).toISOString().slice(0, 16), zone + " " + moment + ": " + text);
      }
    }
  });

  it("gives the same text as formatSavedAt when the computer is set to UTC", () => {
    for (const moment of ["2026-10-25T16:30:00.000Z", "2026-01-05T04:07:00.000Z", "2026-12-31T23:59:59.999Z", "2026-03-01T00:00:00Z", "2026-10-25T18:30:00+02:00"]) {
      assert.equal(inZone("UTC", () => formatLocalTime(moment)), formatSavedAt(moment), moment);
    }
  });

  it("gives null for a text that is not a time with a zone, and for a value that is not text", () => {
    const wrong = [
      "",
      "yesterday",
      "10/25/2026",
      "2026-10-25",
      "2026-10-25T16:30:00", // no zone: a browser would read it in its own time zone
      "2026-10-25 16:30:00Z",
      "2026-13-45T99:99:00Z",
      "2026-10-25T16:30:00.000Z extra",
      undefined,
      null,
      0,
      1761409800000,
      {},
      [],
      true,
    ];
    for (const value of wrong) {
      assert.equal(inZone("Africa/Tunis", () => formatLocalTime(value)), null, JSON.stringify(value));
    }
  });

  it("leaves formatSavedAt as it was: UTC in every zone", () => {
    assert.equal(inZone("Africa/Tunis", () => formatSavedAt("2026-10-25T16:30:00.000Z")), "25 Oct 2026, 16:30 UTC");
    assert.equal(inZone("America/Los_Angeles", () => formatSavedAt("2026-10-25T16:30:00.000Z")), "25 Oct 2026, 16:30 UTC");
  });
});

describe("reportPath", () => {
  it("points to the page of one saved analysis", () => {
    assert.equal(reportPath("6ff69752-c563-4095-b6d4-71a3a62a9221"), "/documents/6ff69752-c563-4095-b6d4-71a3a62a9221");
  });

  it("encodes the id so it cannot change the address", () => {
    assert.equal(reportPath("a/b?c#d"), "/documents/a%2Fb%3Fc%23d");
    assert.equal(reportPath("../x"), "/documents/..%2Fx");
  });
});

describe("riskBadges", () => {
  it("gives one label for each level that has clauses, the highest risk first", () => {
    const badges = riskBadges(row({ clauseCount: 9, highRisks: 2, mediumRisks: 4, lowRisks: 3 }));
    assert.deepEqual(badges, [
      { level: "High", text: "2 High" },
      { level: "Medium", text: "4 Med" },
      { level: "Low", text: "3 Low" },
    ]);
  });

  it("leaves out a level without clauses", () => {
    assert.deepEqual(riskBadges(row({ clauseCount: 3, mediumRisks: 1, lowRisks: 2 })), [
      { level: "Medium", text: "1 Med" },
      { level: "Low", text: "2 Low" },
    ]);
    assert.deepEqual(riskBadges(row({ clauseCount: 1, lowRisks: 1 })), [{ level: "Low", text: "1 Low" }]);
  });

  it("gives an empty list for an analysis without clauses", () => {
    assert.deepEqual(riskBadges(row({})), []);
  });
});

describe("summarizeHistory", () => {
  it("works out the numbers from the rows", () => {
    const list = {
      documents: [
        row({ id: "a", clauseCount: 6, highRisks: 2, mediumRisks: 4 }),
        row({ id: "b", clauseCount: 1, mediumRisks: 1 }),
        row({ id: "c", clauseCount: 3, highRisks: 1, mediumRisks: 2 }),
      ],
      total: 3,
      unreadable: 0,
    };
    assert.deepEqual(summarizeHistory(list), {
      listed: 3,
      total: 3,
      hidden: 0,
      unreadable: 0,
      highRisks: 3,
      withHighRisk: 2,
    });
  });

  it("counts a document with several high-risk clauses once in withHighRisk", () => {
    const list = { documents: [row({ highRisks: 5 })], total: 1, unreadable: 0 };
    const stats = summarizeHistory(list);
    assert.equal(stats.highRisks, 5);
    assert.equal(stats.withHighRisk, 1);
  });

  it("gives zeros for an empty list", () => {
    assert.deepEqual(summarizeHistory({ documents: [], total: 0, unreadable: 0 }), {
      listed: 0,
      total: 0,
      hidden: 0,
      unreadable: 0,
      highRisks: 0,
      withHighRisk: 0,
    });
  });

  it("says how many saved analyses are not in the list", () => {
    const list = { documents: [row({ id: "a" }), row({ id: "b" })], total: 130, unreadable: 0 };
    const stats = summarizeHistory(list);
    assert.equal(stats.listed, 2);
    assert.equal(stats.total, 130);
    assert.equal(stats.hidden, 128);
  });

  it("passes on how many saved files could not be read, and does not count them in the total", () => {
    const list = { documents: [row({})], total: 1, unreadable: 3 };
    const stats = summarizeHistory(list);
    assert.equal(stats.unreadable, 3);
    assert.equal(stats.total, 1);
    assert.equal(stats.hidden, 0);
  });

  it("never shows fewer saved analyses than rows, and never a negative hidden number", () => {
    const list = { documents: [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })], total: 1, unreadable: 0 };
    const stats = summarizeHistory(list);
    assert.equal(stats.total, 3);
    assert.equal(stats.hidden, 0);
  });

  it("does not change the list it was given", () => {
    const list = { documents: [row({ highRisks: 1 })], total: 1, unreadable: 0 };
    const copy = JSON.parse(JSON.stringify(list));
    summarizeHistory(list);
    assert.deepEqual(list, copy);
  });
});

describe("readHistoryFilter", () => {
  it("reads the search text and the risk choice from the address", () => {
    assert.deepEqual(readHistoryFilter({ q: "lease", risk: "high" }), { query: "lease", risk: "high" });
    assert.deepEqual(readHistoryFilter({ q: "lease" }), { query: "lease", risk: null });
    assert.deepEqual(readHistoryFilter({ risk: "none" }), { query: "", risk: "none" });
    assert.deepEqual(readHistoryFilter({}), { query: "", risk: null });
  });

  it("knows the four risk choices and ignores every other value", () => {
    for (const risk of ["high", "medium", "low", "none"]) {
      assert.equal(readHistoryFilter({ risk }).risk, risk);
    }
    for (const risk of ["", "HIGH", "High", " high", "critical", "all", "0", "high,low", "constructor", "__proto__"]) {
      assert.equal(readHistoryFilter({ risk }).risk, null, JSON.stringify(risk));
    }
  });

  it("uses the first value when a part is repeated, and ignores values that are not text", () => {
    assert.deepEqual(readHistoryFilter({ q: ["lease", "nda"], risk: ["low", "high"] }), { query: "lease", risk: "low" });
    assert.deepEqual(readHistoryFilter({ q: [], risk: [] }), { query: "", risk: null });
    assert.deepEqual(readHistoryFilter({ q: 5, risk: true }), { query: "", risk: null });
    assert.deepEqual(readHistoryFilter({ q: undefined, risk: undefined }), { query: "", risk: null });
    assert.deepEqual(readHistoryFilter({ q: { a: 1 }, risk: null }), { query: "", risk: null });
  });

  it("trims the search text and makes every run of spaces, tabs and line breaks one space", () => {
    assert.equal(readHistoryFilter({ q: "  lease   agreement \n 2026\t" }).query, "lease agreement 2026");
    assert.equal(readHistoryFilter({ q: "   " }).query, "");
  });

  it("cuts the search text to 100 characters, and does not end it with a space", () => {
    assert.equal(readHistoryFilter({ q: "a".repeat(100) }).query.length, 100);
    assert.equal(readHistoryFilter({ q: "a".repeat(101) }).query.length, 100);
    assert.equal(readHistoryFilter({ q: "a".repeat(5000) }).query.length, 100);
    assert.equal(readHistoryFilter({ q: "a".repeat(99) + " b" }).query, "a".repeat(99));
    assert.equal(readHistoryFilter({ q: "   " + "a".repeat(100) }).query, "a".repeat(100));
  });

  it("gives no filter for an address that is not an object", () => {
    for (const params of [undefined, null, "q=lease", 5, true]) {
      assert.deepEqual(readHistoryFilter(params), { query: "", risk: null }, JSON.stringify(params));
    }
  });

  it("does not change the object it was given", () => {
    const params = { q: "  lease ", risk: "high" };
    readHistoryFilter(params);
    assert.deepEqual(params, { q: "  lease ", risk: "high" });
  });
});

describe("isFiltering", () => {
  it("is true when a search text or a risk choice is active, and false otherwise", () => {
    assert.equal(isFiltering({ query: "", risk: null }), false);
    assert.equal(isFiltering({ query: "lease", risk: null }), true);
    assert.equal(isFiltering({ query: "", risk: "low" }), true);
    assert.equal(isFiltering({ query: "lease", risk: "low" }), true);
  });
});

describe("filterHistory", () => {
  const rows = [
    row({ id: "a", documentName: "Office_Lease_2026.pdf", clauseCount: 3, highRisks: 1, mediumRisks: 1, lowRisks: 1 }),
    row({ id: "b", documentName: "NDA Freelance.docx", clauseCount: 2, mediumRisks: 2 }),
    row({ id: "c", documentName: "Vendor agreement.pdf", clauseCount: 1, lowRisks: 1 }),
    row({ id: "d", documentName: "empty.pdf" }),
    row({ id: "e", documentName: "lease-amendment.PDF", clauseCount: 2, highRisks: 2 }),
  ];
  const ids = (list) => list.map((item) => item.id);

  it("gives all rows, in the same order, when nothing is asked", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "", risk: null })), ["a", "b", "c", "d", "e"]);
  });

  it("finds file names that contain the text, in any letter case", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "lease", risk: null })), ["a", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "LEASE", risk: null })), ["a", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "pdf", risk: null })), ["a", "c", "d", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "nda f", risk: null })), ["b"]);
  });

  it("finds the file names that contain every word, in any order", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "2026 lease", risk: null })), ["a"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "lease 2026", risk: null })), ["a"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "lease nda", risk: null })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "  lease   pdf ", risk: null })), ["a", "e"]);
  });

  it("looks only in the file name, not in the id or the numbers", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "a1", risk: null })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "16:30", risk: null })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "2026-10-25", risk: null })), []);
    assert.deepEqual(ids(filterHistory([row({ id: "zq7x", documentName: "plain.pdf" })], { query: "zq7x", risk: null })), []);
  });

  it("treats the characters of a pattern as plain text", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: ".*", risk: null })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "(", risk: null })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "[a-z]", risk: null })), []);
    assert.deepEqual(ids(filterHistory([row({ id: "x", documentName: "a+b (1).pdf" })], { query: "a+b (1)", risk: null })), ["x"]);
  });

  it("does not care about accents, in the name or in the search", () => {
    const french = [row({ id: "f", documentName: "contrat_\u00e9t\u00e9.pdf" }), row({ id: "g", documentName: "contrat_ete.pdf" }), row({ id: "h", documentName: "bail.pdf" })];
    assert.deepEqual(ids(filterHistory(french, { query: "ete", risk: null })), ["f", "g"]);
    assert.deepEqual(ids(filterHistory(french, { query: "\u00e9t\u00e9", risk: null })), ["f", "g"]);
    assert.deepEqual(ids(filterHistory(french, { query: "\u00c9T\u00c9", risk: null })), ["f", "g"]);
    assert.deepEqual(ids(filterHistory(french, { query: "e\u0301te\u0301", risk: null })), ["f", "g"]);
  });

  it("finds names in other alphabets too, and does not care about the small marks above Arabic letters", () => {
    const arabic = [row({ id: "i", documentName: "\u0639\u0642\u062f_\u0625\u064a\u062c\u0627\u0631.pdf" }), row({ id: "j", documentName: "other.pdf" }), row({ id: "k", documentName: "\u0639\u064e\u0642\u0652\u062f.pdf" })];
    assert.deepEqual(ids(filterHistory(arabic, { query: "\u0639\u0642\u062f", risk: null })), ["i", "k"]);
    assert.deepEqual(ids(filterHistory(arabic, { query: "\u0639\u064e\u0642\u0652\u062f", risk: null })), ["i", "k"]);
  });

  it("treats tabs and line breaks in the text like spaces between words", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "lease\tpdf", risk: null })), ["a", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "lease\npdf\n2026", risk: null })), ["a"]);
  });

  it("finds the rows that have at least one clause of the risk level", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "", risk: "high" })), ["a", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "", risk: "medium" })), ["a", "b"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "", risk: "low" })), ["a", "c"]);
  });

  it("finds the rows without any clause for none, the same rows that the page labels No clauses", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "", risk: "none" })), ["d"]);
    for (const doc of rows) {
      assert.equal(filterHistory([doc], { query: "", risk: "none" }).length === 1, riskBadges(doc).length === 0, doc.id);
    }
  });

  it("takes none to mean that the row has no risk label, even when the server counted clauses", () => {
    const odd = [row({ id: "o", documentName: "odd.pdf", clauseCount: 4 }), row({ id: "p", documentName: "plain.pdf", clauseCount: 1, lowRisks: 1 })];
    assert.deepEqual(ids(filterHistory(odd, { query: "", risk: "none" })), ["o"]);
    assert.equal(riskBadges(odd[0]).length, 0);
  });

  it("uses the text and the risk choice together", () => {
    assert.deepEqual(ids(filterHistory(rows, { query: "lease", risk: "high" })), ["a", "e"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "lease 2026", risk: "high" })), ["a"]);
    assert.deepEqual(ids(filterHistory(rows, { query: "nda", risk: "high" })), []);
    assert.deepEqual(ids(filterHistory(rows, { query: "pdf", risk: "none" })), ["d"]);
  });

  it("gives an empty list when nothing fits, and for an empty list", () => {
    assert.deepEqual(filterHistory(rows, { query: "zzz", risk: null }), []);
    assert.deepEqual(filterHistory([], { query: "lease", risk: "high" }), []);
    assert.deepEqual(filterHistory([], { query: "", risk: null }), []);
  });

  it("does not change the list it was given, and gives a new list", () => {
    const copy = JSON.parse(JSON.stringify(rows));
    const result = filterHistory(rows, { query: "", risk: null });
    assert.deepEqual(rows, copy);
    assert.notEqual(result, rows);
    filterHistory(rows, { query: "lease", risk: "high" });
    assert.deepEqual(rows, copy);
  });
});

describe("describeFilterResult and searchScopeNote", () => {
  it("says how many of the listed analyses are shown", () => {
    assert.equal(describeFilterResult(2, 12), "Showing 2 of 12 analyses in the list.");
    assert.equal(describeFilterResult(0, 12), "Showing 0 of 12 analyses in the list.");
    assert.equal(describeFilterResult(12, 12), "Showing 12 of 12 analyses in the list.");
    assert.equal(describeFilterResult(1, 1), "Showing 1 of 1 analysis in the list.");
  });

  it("says what the search covers when some saved analyses are not in the list, and nothing otherwise", () => {
    assert.equal(searchScopeNote(100, 7), "The search covers only the 100 analyses in the list, not the 7 that are not shown.");
    assert.equal(searchScopeNote(100, 1), "The search covers only the 100 analyses in the list, not the 1 that is not shown.");
    assert.equal(searchScopeNote(1, 3), "The search covers only the 1 analysis in the list, not the 3 that are not shown.");
    assert.equal(searchScopeNote(100, 0), null);
    assert.equal(searchScopeNote(5, -1), null);
  });
});
