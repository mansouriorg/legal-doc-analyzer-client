"use client";

import Link from "next/link";
import { useEffect, useId, useReducer, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { deleteDocument } from "@/services/api";
import { START_STATE, confirmLabel, deletedPath, nextDeleteState, rowStatusText } from "@/services/deleteFlow";
import type { DeleteOutcome } from "@/types";

interface HistoryRowActionsProps {
  // The id the server gave to the saved analysis.
  documentId: string;
  // Shown in the question, so the person sees which analysis will be deleted.
  documentName: string;
  // "start" in the cards of a phone, "end" in the right-aligned cell of the table.
  align: "start" | "end";
  // The link "View Report", drawn by the page. It stays in view while the question is open.
  children: ReactNode;
}

const NOT_DELETED_TEXT = "The server did not delete the analysis.";

// The actions of one row of the History list: the link to the report, and a Delete button.
// A click on Delete only opens a question inside the row. Nothing is sent to the server
// until the person clicks "Yes, delete it". The steps are the same as for the Delete button of the saved report page.
export default function HistoryRowActions({ documentId, documentName, align, children }: HistoryRowActionsProps) {
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
    // A full page load, so that the list and the three numbers are read from the server again and cannot show the deleted analysis.
    // The address also makes the page show a note that the analysis was deleted.
    window.location.assign(deletedPath(outcome));
  }

  // The question has tabIndex -1, so a click on its text puts the focus inside it, and Escape still works after that click.
  // The Delete button closes it with Escape too.
  function closeWithEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && (state.step === "confirming" || state.step === "failed")) {
      dispatch({ type: "cancel" });
    }
  }

  const open = state.step !== "idle";
  const busy = state.step === "deleting" || state.step === "done";
  const status = rowStatusText(state);

  return (
    <div className={align === "end" ? "flex flex-col items-end gap-3" : "flex flex-col items-start gap-3"}>
      {/* This line stays the same while the question is open, so that a second click cannot land on the link.
          In the table it never wraps (the cell is no-wrap), on a phone it may. */}
      <div className={align === "end" ? "flex items-center justify-end gap-x-4" : "flex flex-wrap items-center gap-x-4 gap-y-2"}>
        {children}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          onClick={() => dispatch({ type: "ask" })}
          onKeyDown={closeWithEscape}
          className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 aria-expanded:bg-red-50"
        >
          Delete<span className="sr-only"> the saved analysis of {documentName}</span>
        </button>
      </div>

      {open ? (
        <div
          role="group"
          aria-labelledby={headingId}
          tabIndex={-1}
          onKeyDown={closeWithEscape}
          className="w-72 max-w-full rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm whitespace-normal text-red-950"
        >
          <p id={headingId} className={state.step === "done" ? "sr-only" : "font-semibold wrap-anywhere"}>
            Delete &ldquo;{documentName}&rdquo;?
          </p>
          {state.step === "done" ? null : (
            <p className="mt-1">
              The saved analysis will be deleted from the server. This cannot be undone. Your original file is not changed.
            </p>
          )}

          {state.step === "failed" ? (
            <p role="alert" className="mt-2 rounded-md border border-red-300 bg-white px-3 py-2 text-red-800 wrap-break-word">
              <span className="font-semibold">The analysis was not deleted.</span> {state.message}
            </p>
          ) : null}

          {state.step === "done" ? null : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-200 disabled:text-red-900"
              >
                {confirmLabel(state)}
              </button>
              <button
                ref={cancelRef}
                type="button"
                onClick={() => dispatch({ type: "cancel" })}
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Always in the page while the question is open, so that a screen reader announces the text when it changes */}
          <p role="status" aria-live="polite" className={status === "" ? "sr-only" : "mt-2 font-medium"}>
            {status}
          </p>

          {state.step === "done" ? (
            <p className="mt-2">
              <Link href={deletedPath(state.outcome)} className="font-semibold text-blue-700 underline hover:text-blue-900">
                Reload the list now
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
