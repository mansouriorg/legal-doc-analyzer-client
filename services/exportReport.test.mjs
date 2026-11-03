import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const { MAX_NAME_LENGTH, REPORT_DEMO_NOTE, REPORT_DISCLAIMER, REPORT_TITLE, buildReportText, reportBaseName, reportFileName } = await import("./exportReport.ts");

function clause(overrides) {
  return {
    id: "c1",
    title: "Dispute Resolution",
    originalText: "Any dispute is decided by the courts of Paris.",
    riskLevel: "High",
    explanation: "You would have to go to court in another country.",
    ...overrides,
  };
}

function analysis(overrides) {
  return {
    id: "a1b2",
    documentName: "NDA.pdf",
    executiveSummary: "A two-way confidentiality agreement.",
    clauses: [clause({})],
    ...overrides,
  };
}

const plainDetails = { notes: [], savedAt: null };

describe("buildReportText: the whole text", () => {
  it("writes the title, the details, the summary, the clauses and the warning, in this order", () => {
    const text = buildReportText(
      analysis({
        clauses: [
          clause({}),
          clause({ id: "c2", title: "Term", originalText: "Two years.", riskLevel: "Low", explanation: "A short term." }),
        ],
      }),
      { notes: ["Only the first 20 pages were read."], savedAt: "31 Oct 2026, 14:02 UTC+1" },
    );

    assert.equal(
      text,
      [
        "LEGAL DOCUMENT ANALYSIS",
        "=======================",
        "",
        "Document: NDA.pdf",
        "Saved: 31 Oct 2026, 14:02 UTC+1",
        "Document ID: a1b2",
        "",
        "NOTE ABOUT THIS ANALYSIS",
        "------------------------",
        "- Only the first 20 pages were read.",
        "",
        "EXECUTIVE SUMMARY",
        "-----------------",
        "A two-way confidentiality agreement.",
        "",
        "CLAUSES AND RISKS",
        "-----------------",
        "2 clauses: 1 High, 1 Low",
        "",
        "1. Dispute Resolution [HIGH RISK]",
        "Original text:",
        '"Any dispute is decided by the courts of Paris."',
        "",
        "AI implication:",
        "You would have to go to court in another country.",
        "",
        "2. Term [LOW RISK]",
        "Original text:",
        '"Two years."',
        "",
        "AI implication:",
        "A short term.",
        "",
        "----------------------------------------",
        REPORT_DISCLAIMER,
        "",
      ].join("\n"),
    );
  });

  it("has the title and the warning as constants, and underlines the title with as many equal signs as it has characters", () => {
    assert.equal(REPORT_TITLE, "Legal Document Analysis");
    const lines = buildReportText(analysis({}), plainDetails).split("\n");
    assert.equal(lines[0], REPORT_TITLE.toUpperCase());
    assert.equal(lines[1], "=".repeat(REPORT_TITLE.length));
    assert.match(REPORT_DISCLAIMER, /first reading/);
    assert.match(REPORT_DISCLAIMER, /not legal advice/);
  });

  it("ends with the warning and one line break, and uses \\n for every line break", () => {
    const text = buildReportText(analysis({ executiveSummary: "Line one.\r\nLine two.\rLine three." }), plainDetails);
    assert.equal(text.endsWith(REPORT_DISCLAIMER + "\n"), true);
    assert.equal(text.endsWith("\n\n"), false);
    assert.equal(text.includes("\r"), false);
    assert.match(text, /Line one\.\nLine two\.\nLine three\./);
  });

  it("writes only plain ASCII of its own, so the file is the same in every text editor", () => {
    const text = buildReportText(analysis({ clauses: [clause({}), clause({ riskLevel: "Medium" }), clause({ riskLevel: "Low" })] }), { notes: ["A note."], savedAt: "31 Oct 2026, 14:02 UTC+1" });
    assert.equal(Array.from(text).every((character) => character.charCodeAt(0) < 128), true);
  });
});

describe("buildReportText: the details", () => {
  it("leaves the Saved line out when there is no usable time, and the ID line when there is no id", () => {
    const text = buildReportText(analysis({ id: undefined }), { notes: [], savedAt: null });
    assert.equal(text.includes("Saved:"), false);
    assert.equal(text.includes("Document ID:"), false);
    assert.equal(buildReportText(analysis({ id: "   " }), plainDetails).includes("Document ID:"), false);
    assert.equal(buildReportText(analysis({}), { notes: [], savedAt: "   " }).includes("Saved:"), false);
  });

  it("writes the time that it is given, without changing it", () => {
    const text = buildReportText(analysis({}), { notes: [], savedAt: "25 Oct 2026, 17:30 UTC+1" });
    assert.match(text, /^Saved: 25 Oct 2026, 17:30 UTC\+1$/m);
  });

  it("takes the spaces around the time away", () => {
    const text = buildReportText(analysis({}), { notes: [], savedAt: "  25 Oct 2026, 17:30 UTC+1  " });
    assert.match(text, /^Saved: 25 Oct 2026, 17:30 UTC\+1$/m);
  });

  it("writes the name of the document on one line", () => {
    assert.match(buildReportText(analysis({ documentName: "  My\nlease \t 2026.pdf " }), plainDetails), /^Document: My lease 2026\.pdf$/m);
    assert.match(buildReportText(analysis({ documentName: "" }), plainDetails), /^Document: \(no name\)$/m);
  });

  it("writes the notes in order, with a heading for one note and another for several", () => {
    const one = buildReportText(analysis({}), { notes: ["First."], savedAt: null });
    assert.match(one, /^NOTE ABOUT THIS ANALYSIS\n-{24}\n- First\.\n\nEXECUTIVE SUMMARY/m);

    const many = buildReportText(analysis({}), { notes: ["First.", "Second.", "Third."], savedAt: null });
    assert.match(many, /^NOTES ABOUT THIS ANALYSIS\n-{25}\n- First\.\n- Second\.\n- Third\.\n\nEXECUTIVE SUMMARY/m);
  });

  it("has no notes section when there are no notes", () => {
    assert.equal(buildReportText(analysis({}), plainDetails).includes("NOTE"), false);
  });

  it("writes a note on one line, with the spaces and line breaks inside it folded into single spaces", () => {
    const text = buildReportText(analysis({}), { notes: ["  Only the first\n20 pages   were read.  "], savedAt: null });
    assert.match(text, /^- Only the first 20 pages were read\.$/m);
  });

  it("says at the top that a built-in example is not a real analysis, and says nothing of the kind otherwise", () => {
    assert.equal(buildReportText(analysis({ isDemo: true }), plainDetails).includes(REPORT_DEMO_NOTE), true);
    assert.equal(buildReportText(analysis({ isDemo: false }), plainDetails).includes("DEMO"), false);
    assert.equal(buildReportText(analysis({}), plainDetails).includes("DEMO"), false);
    const lines = buildReportText(analysis({ isDemo: true }), plainDetails).split("\n");
    assert.ok(lines.indexOf(REPORT_DEMO_NOTE) < lines.indexOf("EXECUTIVE SUMMARY"));
  });

  it("says the same words each time, and only for a value that is exactly true", () => {
    assert.equal(REPORT_DEMO_NOTE, "DEMO EXAMPLE. The clauses below are made up. They are not an analysis of a real document.");
    assert.match(buildReportText(analysis({ isDemo: true }), plainDetails), /^DEMO EXAMPLE\. The clauses below are made up\. They are not an analysis of a real document\.$/m);
    assert.equal(buildReportText(analysis({ isDemo: "yes" }), plainDetails).includes("DEMO"), false);
    assert.equal(buildReportText(analysis({ isDemo: 1 }), plainDetails).includes("DEMO"), false);
    assert.equal(buildReportText(analysis({ isDemo: "true" }), plainDetails).includes("DEMO"), false);
  });
});

describe("buildReportText: the summary and the clauses", () => {
  it("keeps the line breaks of a long summary", () => {
    const text = buildReportText(analysis({ executiveSummary: "First paragraph.\n\nSecond paragraph." }), plainDetails);
    assert.match(text, /EXECUTIVE SUMMARY\n-{17}\nFirst paragraph\.\n\nSecond paragraph\.\n\nCLAUSES AND RISKS/);
  });

  it("writes the original text of a clause between quotation marks, without the spaces around it and with plain line breaks", () => {
    const text = buildReportText(analysis({ clauses: [clause({ originalText: "  Line one.\r\nLine two.  " })] }), plainDetails);
    assert.equal(text.includes('Original text:\n"Line one.\nLine two."\n\nAI implication:'), true);
    assert.equal(text.includes("\r"), false);
  });

  it("numbers the clauses from 1 and writes the level of risk in capital letters", () => {
    const text = buildReportText(
      analysis({ clauses: [clause({ title: "A", riskLevel: "High" }), clause({ title: "B", riskLevel: "Medium" }), clause({ title: "C", riskLevel: "Low" })] }),
      plainDetails,
    );
    assert.match(text, /^1\. A \[HIGH RISK\]$/m);
    assert.match(text, /^2\. B \[MEDIUM RISK\]$/m);
    assert.match(text, /^3\. C \[LOW RISK\]$/m);
    assert.ok(text.indexOf("1. A") < text.indexOf("2. B") && text.indexOf("2. B") < text.indexOf("3. C"));
  });

  it("counts the clauses by level, in the order High, Medium, Low, and leaves out a level without clauses", () => {
    const three = buildReportText(
      analysis({ clauses: [clause({ riskLevel: "Low" }), clause({ riskLevel: "High" }), clause({ riskLevel: "Medium" }), clause({ riskLevel: "High" })] }),
      plainDetails,
    );
    assert.match(three, /^4 clauses: 2 High, 1 Medium, 1 Low$/m);
    assert.match(buildReportText(analysis({ clauses: [clause({ riskLevel: "Medium" })] }), plainDetails), /^1 clause: 1 Medium$/m);
    assert.match(buildReportText(analysis({ clauses: [clause({ riskLevel: "Low" }), clause({ riskLevel: "Low" })] }), plainDetails), /^2 clauses: 2 Low$/m);
  });

  it("writes a level that it does not know as it is, and does not count it", () => {
    const text = buildReportText(analysis({ clauses: [clause({ riskLevel: "Critical" }), clause({ riskLevel: "High" })] }), plainDetails);
    assert.match(text, /^1\. Dispute Resolution \[CRITICAL RISK\]$/m);
    assert.match(text, /^2 clauses: 1 High$/m);
    assert.match(buildReportText(analysis({ clauses: [clause({ riskLevel: "" })] }), plainDetails), /\[UNKNOWN RISK\]/);
  });

  it("puts the original text between straight quotes, and the implication under it", () => {
    const text = buildReportText(analysis({ clauses: [clause({ originalText: "Pay in 30 days.", explanation: "Late payment costs 5 %." })] }), plainDetails);
    assert.match(text, /Original text:\n"Pay in 30 days\."\n\nAI implication:\nLate payment costs 5 %\./);
  });

  it("keeps the text of a clause as it is: special characters, line breaks and a very long text", () => {
    const long = "word ".repeat(4000).trim();
    const text = buildReportText(
      analysis({ clauses: [clause({ title: "Title <b>& \"quotes\"", originalText: "Line one\nLine two: 100% $5 {x} `y`", explanation: long })] }),
      plainDetails,
    );
    assert.match(text, /^1\. Title <b>& "quotes" \[HIGH RISK\]$/m);
    assert.match(text, /"Line one\nLine two: 100% \$5 \{x\} `y`"/);
    assert.equal(text.includes(long), true);
  });

  it("keeps text that is not in the Latin alphabet", () => {
    const arabic = String.fromCharCode(0x639, 0x642, 0x62f);
    const french = "contrat " + String.fromCharCode(0xe9, 0x74, 0xe9);
    const text = buildReportText(analysis({ documentName: french + ".pdf", executiveSummary: arabic, clauses: [clause({ title: arabic })] }), plainDetails);
    assert.equal(text.includes("Document: " + french + ".pdf"), true);
    assert.equal(text.includes(arabic + "\n"), true);
    assert.equal(text.includes("1. " + arabic + " [HIGH RISK]"), true);
  });

  it("says so when there are no clauses", () => {
    const text = buildReportText(analysis({ clauses: [] }), plainDetails);
    assert.match(text, /CLAUSES AND RISKS\n-{17}\nNo clauses were found\.\n\n-{40}\n/);
    assert.equal(text.includes("0 clauses"), false);
  });

  it("writes (none) for a part that is missing, and never the words undefined or null", () => {
    const text = buildReportText(
      { documentName: "x.pdf", executiveSummary: undefined, clauses: [{ id: "c", title: undefined, originalText: null, riskLevel: undefined, explanation: 5 }] },
      plainDetails,
    );
    assert.match(text, /EXECUTIVE SUMMARY\n-{17}\n\(none\)\n/);
    assert.match(text, /^1\. \(no title\) \[UNKNOWN RISK\]$/m);
    assert.match(text, /Original text:\n\(none\)\n\nAI implication:\n\(none\)\n/);
    for (const bad of ["undefined", "null", "NaN", "[object Object]"]) {
      assert.equal(text.includes(bad), false, bad);
    }
  });

  it("does not stop for data without a list of clauses", () => {
    const text = buildReportText({ documentName: "x.pdf", executiveSummary: "s" }, plainDetails);
    assert.match(text, /^No clauses were found\.$/m);
  });

  it("does not change the analysis or the details that it was given", () => {
    const data = analysis({ clauses: [clause({}), clause({ riskLevel: "Low" })] });
    const details = { notes: ["A note."], savedAt: "31 Oct 2026, 14:02 UTC+1" };
    const dataCopy = JSON.parse(JSON.stringify(data));
    const detailsCopy = JSON.parse(JSON.stringify(details));
    buildReportText(data, details);
    assert.deepEqual(data, dataCopy);
    assert.deepEqual(details, detailsCopy);
  });

  it("gives the same text for the same input", () => {
    assert.equal(buildReportText(analysis({}), plainDetails), buildReportText(analysis({}), plainDetails));
  });
});

describe("reportFileName and reportBaseName", () => {
  it("names the file after the document, without its extension, and adds -analysis and .txt", () => {
    assert.equal(reportFileName("NDA.pdf"), "NDA-analysis.txt");
    assert.equal(reportFileName("Lease 2026.docx"), "Lease 2026-analysis.txt");
    assert.equal(reportFileName("Office_Lease_2026.PDF"), "Office_Lease_2026-analysis.txt");
    assert.equal(reportBaseName("NDA.pdf"), "NDA-analysis");
  });

  it("removes only the last extension, and only .pdf and .docx", () => {
    assert.equal(reportFileName("a.pdf.docx"), "a.pdf-analysis.txt");
    assert.equal(reportFileName("notes.txt"), "notes.txt-analysis.txt");
    assert.equal(reportFileName("v1.2"), "v1.2-analysis.txt");
    assert.equal(reportFileName("mypdf"), "mypdf-analysis.txt");
  });

  it("makes spaces, tabs and line breaks one space, and removes the spaces at both ends", () => {
    assert.equal(reportFileName("  my \t lease\n2026 .pdf"), "my lease 2026-analysis.txt");
  });

  it("replaces the characters that file systems refuse, one underscore for each run of them", () => {
    assert.equal(reportFileName('a/b\\c:d*e?f"g<h>i|j.pdf'), "a_b_c_d_e_f_g_h_i_j-analysis.txt");
    assert.equal(reportFileName("a///b.pdf"), "a_b-analysis.txt");
    assert.equal(reportFileName("a/ /b.pdf"), "a_ _b-analysis.txt");
  });

  it("does not touch underscores, dashes and brackets that are in the name", () => {
    assert.equal(reportFileName("Office__Lease-2026 (final).pdf"), "Office__Lease-2026 (final)-analysis.txt");
  });

  it("replaces control characters, and the invisible marks that change the direction of the text", () => {
    const marks = [0, 7, 31, 127, 0x200b, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069].map((code) => String.fromCharCode(code));
    for (const mark of marks) {
      assert.equal(reportFileName("a" + mark + "b.pdf"), "a_b-analysis.txt", "code " + mark.charCodeAt(0));
    }
    assert.equal(reportFileName("gpj" + String.fromCharCode(0x202e) + "txt.pdf"), "gpj_txt-analysis.txt");
    // Spaces of every kind, and the byte order mark, count as one plain space.
    for (const code of [0xa0, 0x2003, 0x2028, 0x3000, 0xfeff]) {
      assert.equal(reportFileName("a" + String.fromCharCode(code) + "b.pdf"), "a b-analysis.txt", "code " + code);
    }
  });

  it("keeps letters of other alphabets and accents", () => {
    const french = "contrat " + String.fromCharCode(0xe9, 0x74, 0xe9);
    const arabic = String.fromCharCode(0x639, 0x642, 0x62f);
    assert.equal(reportFileName(french + ".pdf"), french + "-analysis.txt");
    assert.equal(reportFileName(arabic + ".docx"), arabic + "-analysis.txt");
  });

  it("does not start with a dot, so the file is not hidden", () => {
    assert.equal(reportFileName("..hidden.pdf"), "hidden-analysis.txt");
    assert.equal(reportFileName(". .secret"), "secret-analysis.txt");
  });

  it("gives analysis.txt when nothing usable is left", () => {
    for (const name of ["", "   ", ".pdf", ".docx", "...", "???", "///", "_", " . ", "?.", "*..", "_.", "? . ?", undefined, null, 5, {}]) {
      assert.equal(reportFileName(name), "analysis.txt", JSON.stringify(name));
    }
  });

  it("keeps at most 80 characters of the name", () => {
    assert.equal(MAX_NAME_LENGTH, 80);
    assert.equal(reportFileName("a".repeat(200) + ".pdf"), "a".repeat(80) + "-analysis.txt");
    assert.equal(reportFileName("a".repeat(80) + ".pdf"), "a".repeat(80) + "-analysis.txt");
    assert.equal(reportFileName("a".repeat(81)), "a".repeat(80) + "-analysis.txt");
  });

  it("cuts by characters, so a character that is made of two units of the string is never cut in two", () => {
    const smile = String.fromCodePoint(0x1f600);
    const name = reportBaseName(smile.repeat(100) + ".pdf");
    assert.equal(Array.from(name).length, 80 + "-analysis".length);
    for (const character of Array.from(name)) {
      const code = character.codePointAt(0);
      assert.equal(code >= 0xd800 && code <= 0xdfff, false, "a lone half of a pair");
    }
  });

  it("removes spaces left at the end after the cut", () => {
    assert.equal(reportFileName("a".repeat(79) + " b.pdf"), "a".repeat(79) + "-analysis.txt");
  });

  it("never gives a name with a character that a file system refuses, for any single character", () => {
    for (let code = 0; code < 0x2200; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) {
        continue;
      }
      const name = reportFileName("a" + String.fromCharCode(code) + "b");
      for (const character of name) {
        const value = character.codePointAt(0);
        assert.equal(value < 32 || value === 127 || "/\\:*?\"<>|".includes(character), false, "code " + code);
      }
      assert.equal(name.startsWith("."), false, "code " + code);
      assert.equal(name.endsWith("-analysis.txt"), true, "code " + code);
    }
  });

  it("always ends with -analysis before the extension, so it cannot be taken for the document", () => {
    for (const name of ["NDA.pdf", "con.pdf", "aux", "CON", "nul.docx"]) {
      assert.match(reportFileName(name), /-analysis\.txt$/);
    }
  });

  it("gives the title of the printed page without the extension", () => {
    assert.equal(reportBaseName("Lease 2026.pdf"), "Lease 2026-analysis");
    assert.equal(reportFileName("Lease 2026.pdf"), reportBaseName("Lease 2026.pdf") + ".txt");
  });
});
