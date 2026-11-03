"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { buildReportText, reportBaseName, reportFileName } from "@/services/exportReport";
import { formatLocalTime } from "@/services/history";
import type { DocumentAnalysis } from "@/types";

interface ReportActionsProps {
  data: DocumentAnalysis;
  // The notes of the analysis, already cleaned (see cleanNotes in services/api.ts).
  notes: string[];
  // More buttons for the same row (the upload page puts "Analyze Another Document" here).
  children?: ReactNode;
}

const BUTTON_CLASS =
  "px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm";

// Two buttons that take the analysis out of the page: one prints it (or saves it as a PDF, in the window of the browser),
// and one downloads it as a text file. Nothing is sent to the server.
export default function ReportActions({ data, notes, children }: ReportActionsProps) {
  const [status, setStatus] = useState("");

  function printReport() {
    // Many browsers offer the title of the page as the suggested name of a PDF, so the title is the name of the report while the window is open.
    const previousTitle = document.title;
    document.title = reportBaseName(data.documentName);
    try {
      window.print();
    } finally {
      document.title = previousTitle;
    }
  }

  function downloadReport() {
    try {
      const fileName = reportFileName(data.documentName);
      const text = buildReportText(data, { notes, savedAt: formatLocalTime(data.savedAt) });
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Some browsers still need the address for a moment after the click.
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(`File ready: ${fileName}. Your browser saves it, usually in the downloads folder.`);
    } catch (error) {
      console.error("Could not make the file:", error);
      setStatus("The file could not be made. You can use Print or save as PDF instead.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={printReport} className={BUTTON_CLASS}>
          Print or save as PDF
        </button>
        <button type="button" onClick={downloadReport} className={BUTTON_CLASS}>
          Download as text
        </button>
        {children}
      </div>
      <p role="status" className="text-xs text-slate-600 wrap-break-word">
        {status}
      </p>
    </div>
  );
}
