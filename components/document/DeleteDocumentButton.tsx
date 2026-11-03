"use client";

import Link from "next/link";
import { useEffect, useId, useReducer, useRef } from "react";
import type { KeyboardEvent } from "react";
import { deleteDocument } from "@/services/api";
import { AFTER_DELETE_PATH, START_STATE, confirmLabel, deletedPath, nextDeleteState, statusText } from "@/services/deleteFlow";
import type { DeleteOutcome } from "@/types";

interface DeleteDocumentButtonProps {
  // The id the server gave to the saved analysis.
  documentId: string;
  // Shown in the question, so the person sees what will be deleted.
  documentName: string;
}

const NOT_DELETED_TEXT = "The server did not delete the analysis.";

// A button that deletes one saved analysis. A click only opens a question under the button.
// Nothing is sent to the server until the person clicks "Yes, delete it".
export default function DeleteDocumentButton({ documentId, documentName }: DeleteDocumentButtonProps) {
  const [state, dispatch] = useReducer(nextDeleteState, START_STATE);
  const headingId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Keyboard users: the question starts on the safe button ("Cancel"), and closing it
  // brings the focus back to the button that opened it.
  useEffect(() => {
    if (state.step === "confirming" || state.step === "failed") {
      cancelRef.current?.focus();
    } else if (state.step === "idle" && wasOpen.current) {
      triggerRef.current?.focus();
    }
    wasOpen.current = state.step !== "idle";
  }, [state.step]);

  async function confirmDelete() {
    // A second click while the first request is running does nothing.
    if (state.step !== "confirming" && state.step !== "failed") {
      return;
    }

    dispatch({ type: "confirm" });

    let outcome: DeleteOutcome;
    try {
      outcome = await deleteDocument(documentId);
    } catch (error) {
      dispatch({
        type: "failed",
        message: error instanceof Error && error.message !== "" ? error.message : NOT_DELETED_TEXT,
      });
      return;
    }

    dispatch({ type: "succeeded", outcome });
    // A full page load, so that the History page is read from the server again and cannot show the deleted analysis.
    // The address also makes the History page show a note that the analysis was deleted.
    window.location.assign(deletedPath(outcome));
  }

  function closeWithEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && (state.step === "confirming" || state.step === "failed")) {
      dispatch({ type: "cancel" });
    }
  }

  if (state.step === "idle") {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => dispatch({ type: "ask" })}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
      >
        <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        Delete this analysis
      </button>
    );
  }

  const busy = state.step === "deleting" || state.step === "done";
  const status = statusText(state);
  // When the analysis is deleted, only the status and the link are shown. The question is no longer true.
  let statusClass = "mt-3 font-medium";
  if (status === "") {
    statusClass = "sr-only";
  } else if (state.step === "done") {
    statusClass = "font-medium";
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onKeyDown={closeWithEscape}
      className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950"
    >
      <p id={headingId} className={state.step === "done" ? "sr-only" : "font-semibold"}>Delete this saved analysis?</p>
      {state.step === "done" ? null : (
        <p className="mt-1 wrap-break-word">
          The saved analysis of &ldquo;{documentName}&rdquo; will be deleted from the server. This cannot be undone. Your original file is not changed.
        </p>
      )}

      {state.step === "failed" ? (
        <p role="alert" className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-red-800 wrap-break-word">
          <span className="font-semibold">The analysis was not deleted.</span> {state.message}
        </p>
      ) : null}

      {state.step === "done" ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={busy}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-200 disabled:text-red-900"
          >
            {confirmLabel(state)}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={() => dispatch({ type: "cancel" })}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Always in the page, so that a screen reader announces the text when it changes */}
      <p role="status" aria-live="polite" className={statusClass}>
        {status}
      </p>

      {state.step === "done" ? (
        <p className="mt-2">
          <Link href={AFTER_DELETE_PATH} className="font-semibold text-blue-700 underline hover:text-blue-900">
            Go to the History page now
          </Link>
        </p>
      ) : null}
    </div>
  );
}
