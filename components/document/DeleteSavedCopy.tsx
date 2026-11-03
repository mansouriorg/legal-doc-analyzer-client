"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import type { KeyboardEvent } from "react";
import { deleteDocument } from "@/services/api";
import { START_STATE, confirmLabel, copyStatusText, nextDeleteState } from "@/services/deleteFlow";
import type { DeleteOutcome } from "@/types";

interface DeleteSavedCopyProps {
  // The id the server gave to the copy that it saved.
  documentId: string;
  // Shown in the question, so the person sees what will be deleted.
  documentName: string;
  // Called once, after the server has deleted the copy or has said that it is already gone.
  // The page uses it to drop what is no longer true: the "Saved" time and the note that the server saved the analysis.
  onDeleted: () => void;
}

const NOT_DELETED_TEXT = "The server did not delete the saved copy.";

// The box above the results of the upload page. The page shows it only when the person ticked "Do not keep this analysis"
// and the server saved the analysis anyway. A click on the button only opens a question under it.
// Nothing is sent to the server until the person clicks "Yes, delete it".
// Unlike the Delete button of the saved report page, this one does not leave the page: the analysis stays on the screen.
export default function DeleteSavedCopy({ documentId, documentName, onDeleted }: DeleteSavedCopyProps) {
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
    onDeleted();
  }

  function closeWithEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && (state.step === "confirming" || state.step === "failed")) {
      dispatch({ type: "cancel" });
    }
  }

  if (state.step === "idle") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0">The server kept a copy of this analysis, although you asked not to keep it.</p>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => dispatch({ type: "ask" })}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Delete the saved copy now
        </button>
      </div>
    );
  }

  const busy = state.step === "deleting" || state.step === "done";
  const done = state.step === "done";
  const status = copyStatusText(state);
  // When the copy is deleted, only the status is shown. The question is no longer true.
  let statusClass = "mt-3 font-medium";
  if (status === "") {
    statusClass = "sr-only";
  } else if (done) {
    statusClass = "font-medium";
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      onKeyDown={closeWithEscape}
      className={
        done
          ? "rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950"
          : "rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950"
      }
    >
      <p id={headingId} className={done ? "sr-only" : "font-semibold"}>Delete the saved copy?</p>
      {done ? null : (
        <p className="mt-1 wrap-break-word">
          The saved copy of &ldquo;{documentName}&rdquo; will be deleted from the server. This cannot be undone. The analysis stays on this page until you leave it, and your original file is not changed.
        </p>
      )}

      {state.step === "failed" ? (
        <p role="alert" className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-red-800 wrap-break-word">
          <span className="font-semibold">The saved copy was not deleted.</span> {state.message}
        </p>
      ) : null}

      {done ? null : (
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
    </div>
  );
}
