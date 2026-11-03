"use client";

import { useEffect, useRef, useState } from "react";
import { analyzeDocument, getDemoAnalysis, savedAgainstChoice, withoutSavedCopy } from "@/services/api";
import { STOP_HINT, stoppedNotice } from "@/services/analyzeFlow";
import { DocumentAnalysis } from "@/types";
import AnalysisResults from "@/components/document/AnalysisResults";
import DeleteSavedCopy from "@/components/document/DeleteSavedCopy";
import UploadZone from "@/components/document/UploadZone";
import LoadingState from "@/components/ui/LoadingState"; // Import the new LoadingState component

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // true when the person ticked "Do not keep this analysis". The box starts empty, so by default the server decides, and it saves.
  const [doNotKeep, setDoNotKeep] = useState(false);
  // The id of the copy that the server saved although the person ticked the box, or null. It is set when the answer comes in,
  // and it stays set after the copy is deleted, so that the box can show the result.
  const [savedCopyId, setSavedCopyId] = useState<string | null>(null);

  // true after the person has stopped an analysis. The upload screen then shows a notice, and the file is still selected.
  const [stopped, setStopped] = useState(false);
  // The request that is running. It is null when none runs, and also after the person has stopped it.
  const requestRef = useRef<AbortController | null>(null);
  // After a stop, the focus moves to the notice, because the button that was clicked is gone.
  const stoppedRef = useRef<HTMLDivElement>(null);
  const focusStopped = useRef(false);

  // Leaving the page stops the request that is still running.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  // After a stop the notice appears, and the focus goes to it.
  useEffect(() => {
    if (stopped && focusStopped.current) {
      stoppedRef.current?.focus();
    }
    focusStopped.current = false;
  }, [stopped]);

  const handleUpload = async () => {
    // A second click while an analysis runs does nothing.
    if (file === null || requestRef.current !== null) return;

    const controller = new AbortController();
    requestRef.current = controller;
    setIsUploading(true);
    setErrorMessage(null);
    setStopped(false);

    try {
      // Call the API service to process the document
      const result = await analyzeDocument(file, { keep: doNotKeep === false, signal: controller.signal });

      // The person may have stopped this analysis, or left the page, while the server worked. Then the result is no longer wanted.
      if (requestRef.current !== controller) return;

      // Store the result to trigger the UI switch
      setAnalysisData(result);
      setSavedCopyId(savedAgainstChoice(result, doNotKeep));

    } catch (error) {
      // A stop ends the request with an error too. It is not a failure, so nothing is shown for it.
      if (requestRef.current !== controller) return;

      console.error("Upload failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong while analyzing the document.",
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsUploading(false);
      }
    }
  };

  // Stops the waiting for the running analysis. The upload screen comes back with the file still selected, and a notice.
  const stop = () => {
    const controller = requestRef.current;
    if (controller === null) return;

    // The ref is cleared first, so that the result of this request is ignored when it comes in.
    requestRef.current = null;
    controller.abort();
    focusStopped.current = true;
    setStopped(true);
    setIsUploading(false);
  };

  return (
    <main className="flex-grow bg-slate-50 flex flex-col items-center justify-center p-6">

      {/* 1. Show the Loading Animation if processing */}
      {isUploading ? (
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl p-10 border border-slate-100 min-h-[400px] flex flex-col items-center justify-center">
          <LoadingState />
          {/* The analysis can take a minute or more, so the person can stop it without closing the tab */}
          <button
            type="button"
            onClick={stop}
            className="px-6 py-2.5 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Stop the analysis
          </button>
          <p className="mt-3 text-sm text-slate-600 text-center">{STOP_HINT}</p>
        </div>
      ) : analysisData === null ? (
        /* 2. Show the Upload Box if we are NOT loading and have NO data */
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl p-10 border border-slate-100">

          {/* Header Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
              AI Legal Document Analyzer
            </h1>
            <p className="text-lg text-slate-600">
              Upload your contracts and international agreements. Our AI will automatically extract key clauses, obligations, and flag potential risks.
            </p>
          </div>

          {/* New Drag and Drop Upload Zone */}
          <UploadZone
            onFileSelect={(selectedFile) => {
              setFile(selectedFile);
              setAnalysisData(null); // Reset analysis if they drop a new file
              setErrorMessage(null);
              setStopped(false);
            }}
            selectedFile={file}
            disabled={isUploading}
          />

          {/* The choice not to keep the analysis. Ticked: the form field save=false is sent with the file. Not ticked: nothing is sent. */}
          <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={doNotKeep}
              onChange={(event) => setDoNotKeep(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
            />
            <span>
              <span className="font-semibold text-slate-800">Do not keep this analysis</span>
              <span className="mt-0.5 block text-slate-600">
                Normally the server saves each analysis (it holds quotes from your document), so it is in the History list and you can ask questions about it later. Tick this box to analyze the document without saving it. The analysis is then shown only here, and it is gone when you leave the page.
              </span>
            </span>
          </label>

          {/* Error message, shown only after a failed analysis */}
          {errorMessage !== null ? (
            <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">The document could not be analyzed.</p>
              <p className="mt-1">{errorMessage}</p>
              <p className="mt-2">
                You can try again, or look at a demo example. The demo is made-up data, not an analysis of your file.
              </p>
            </div>
          ) : null}

          {/* Shown after the person has stopped an analysis. A stop is not a failure, so it is not a red box. */}
          {stopped ? (
            <div ref={stoppedRef} role="status" tabIndex={-1} className="mt-6 rounded-lg border border-slate-300 bg-slate-100 p-4 text-sm text-slate-800">
              {stoppedNotice(doNotKeep === false).map((line, index) => (
                <p key={line} className={index === 0 ? "font-semibold" : "mt-1"}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleUpload}
              disabled={file === null}
              className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
                file === null
                  ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
              }`}
            >
              Analyze Document
            </button>
            {errorMessage !== null ? (
              <button
                onClick={() => {
                  setAnalysisData(getDemoAnalysis());
                  setErrorMessage(null);
                }}
                className="px-8 py-3 rounded-lg font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Show a demo example
              </button>
            ) : null}
          </div>

        </div>
      ) : (
        /* 3. Render the AnalysisResults component if we HAVE data */
        <div className="w-full flex-grow flex flex-col">
          <AnalysisResults
            data={analysisData}
            file={file}
            notice={
              savedCopyId === null ? null : (
                <DeleteSavedCopy
                  key={savedCopyId}
                  documentId={savedCopyId}
                  documentName={analysisData.documentName}
                  onDeleted={() =>
                    setAnalysisData((current) => (current !== null && current.id === savedCopyId ? withoutSavedCopy(current) : current))
                  }
                />
              )
            }
            onReset={() => {
              // Clear the state to go back to the upload screen
              setAnalysisData(null);
              setSavedCopyId(null);
              setFile(null);
              setErrorMessage(null);
              setStopped(false);
            }}
          />
        </div>
      )}

    </main>
  );
}
