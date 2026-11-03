"use client";

import { DocumentAnalysis, RiskLevel } from "@/types";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { canPreviewFile } from "@/services/previewRules";
import { cleanNotes } from "@/services/api";
import { formatSavedAt } from "@/services/history";
import LocalTime from "@/components/document/LocalTime";
import ReportActions from "@/components/document/ReportActions";
import { REPORT_DISCLAIMER } from "@/services/exportReport";

interface AnalysisResultsProps {
  data: DocumentAnalysis;
  // The uploaded file. Only available right after an upload; saved documents have none.
  file?: File | null;
  // The reset button is shown only when the parent passes this (the upload page does).
  onReset?: () => void;
  // A box that the parent wants between the notes and the title. The upload page uses it for the button that deletes a saved copy.
  // It is not printed.
  notice?: ReactNode;
}

export default function AnalysisResults({ data, file, onReset, notice }: AnalysisResultsProps) {
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Point the preview frame at a local URL for the uploaded file (no backend needed).
  // The frame is updated directly instead of through state, which the lint rules prefer.
  useEffect(() => {
    const frame = previewRef.current;
    if (file === undefined || file === null || frame === null) {
      return;
    }

    const url = URL.createObjectURL(file);
    frame.src = url;

    // Cleanup the URL to prevent memory leaks when the component unmounts
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // A saved document has no file, so it gets one centred column instead of an empty preview pane.
  const hasFile = file !== undefined && file !== null;
  // Only PDF files can be shown in the frame. A Word file would start a download instead.
  const showFrame = file !== undefined && file !== null && canPreviewFile(file);
  // Notes written by the server, for example a warning that the document speaks to an AI.
  const notes = cleanNotes(data.notes);
  // When the server saved this analysis (undefined when the server sent no usable time). LocalTime shows it on the clock of the person.
  const savedAt = formatSavedAt(data.savedAt) === null ? undefined : data.savedAt;

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "High": return "bg-red-100 text-red-800 border-red-200";
      case "Medium": return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto mt-4 flex flex-col ${hasFile ? "lg:h-[85vh] print:h-auto" : ""}`}>

      {data.isDemo === true ? (
        <div role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Demo data.</span> The clauses below are a made-up example. They are not an analysis of your document.
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div role="note" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{notes.length === 1 ? "Note about this analysis" : "Notes about this analysis"}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 wrap-break-word">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice === undefined || notice === null ? null : <div className="mb-4 print:hidden">{notice}</div>}

      {/* Header and Controls: stacked on small screens, side by side from the sm size up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900 wrap-break-word">{data.documentName}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {data.isDemo === true ? "Demo example" : "Analysis Complete"}
            {savedAt === undefined ? null : <> &middot; Saved <LocalTime value={savedAt} /></>}
          </p>
        </div>
        {/* The buttons are not printed. */}
        <div className="self-start sm:self-auto print:hidden">
          <ReportActions data={data} notes={notes}>
            {onReset ? (
              <button
                onClick={onReset}
                className="shrink-0 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                Analyze Another Document
              </button>
            ) : null}
          </ReportActions>
        </div>
      </div>

      {/* Below the lg size the page scrolls as normal and the results come first.
          From lg up, the preview is on the left and each side scrolls by itself. */}
      <div className={`grid grid-cols-1 gap-6 flex-grow ${hasFile ? "lg:grid-cols-2 lg:overflow-hidden print:grid-cols-1 print:overflow-visible" : ""}`}>

        {/* Document Viewer: only when we have the uploaded file */}
        {hasFile ? (
          <div className="order-2 lg:order-1 h-96 lg:h-auto bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex flex-col print:hidden">
            <div className="bg-slate-800 px-4 py-2 flex justify-between items-center text-slate-200 text-sm font-medium">
              <span>Original Document</span>
              <span className="text-xs text-slate-400">Preview</span>
            </div>
            <div className="flex-grow w-full h-full bg-white relative">
              {showFrame ? (
                <iframe
                  ref={previewRef}
                  className="w-full h-full border-none absolute inset-0"
                  title="Document Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center text-slate-500">
                  No preview is available for this file type. Only PDF files can be shown here.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* AI Analysis Results (scrolls by itself only from lg up, next to the preview) */}
        <div className={`order-1 lg:order-2 flex flex-col space-y-6 lg:pb-10 ${hasFile ? "lg:overflow-y-auto lg:pr-2 print:overflow-visible" : "w-full max-w-3xl mx-auto"}`}>

          {/* Executive Summary */}
          <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 ${hasFile ? "lg:sticky lg:top-0 lg:z-10 print:static" : ""}`}>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Executive Summary
            </h3>
            <p className="text-slate-700 leading-relaxed text-sm wrap-break-word">
              {data.executiveSummary}
            </p>
          </div>

          {/* Clauses List */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">
              Extracted Clauses & Risks
            </h3>
            <div className="space-y-4">
              {data.clauses.map((clause) => (
                <div key={clause.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 hover:border-blue-300 transition-colors wrap-break-word print:break-inside-avoid">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="min-w-0 text-base font-bold text-slate-800">
                      {clause.title}
                    </h4>
                    <span className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskColor(clause.riskLevel)}`}>
                      {clause.riskLevel} Risk
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 border-l-4 border-slate-300">
                    <span className="block font-semibold text-slate-700 text-xs uppercase mb-1">Original Text:</span>
                    &ldquo;{clause.originalText}&rdquo;
                  </div>

                  <div className="mt-1">
                    <span className="block font-semibold text-slate-700 text-xs uppercase mb-1">AI Implication:</span>
                    <span className="text-sm text-slate-700">{clause.explanation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Only a printed page shows this. A file carries the same warning, because it leaves the page. */}
          <p className="hidden print:block text-xs text-slate-600">{REPORT_DISCLAIMER}</p>

        </div>
      </div>
    </div>
  );
}
