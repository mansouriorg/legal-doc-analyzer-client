// services/deleteFlow.ts
// The steps of deleting a saved analysis, written as plain data and one function.
// The button component only draws the current step, so the rules can be tested without a browser.
import type { DeleteOutcome } from "@/types";

// Where the person goes after the analysis is gone: the list of saved analyses.
export const AFTER_DELETE_PATH = "/dashboard";

export type DeleteState =
  | { step: "idle" }
  | { step: "confirming" }
  | { step: "deleting" }
  | { step: "failed"; message: string }
  | { step: "done"; outcome: DeleteOutcome };

export type DeleteAction =
  | { type: "ask" }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "succeeded"; outcome: DeleteOutcome }
  | { type: "failed"; message: string };

export const START_STATE: DeleteState = { step: "idle" };

// Gives the next state. An action that does not fit the current step is ignored and the same state comes back.
// That is what stops a second click from sending a second request while the first one is still running.
export function nextDeleteState(state: DeleteState, action: DeleteAction): DeleteState {
  switch (state.step) {
    case "idle":
      return action.type === "ask" ? { step: "confirming" } : state;
    case "confirming":
      if (action.type === "cancel") {
        return { step: "idle" };
      }
      return action.type === "confirm" ? { step: "deleting" } : state;
    case "deleting":
      if (action.type === "succeeded") {
        return { step: "done", outcome: action.outcome };
      }
      return action.type === "failed" ? { step: "failed", message: action.message } : state;
    case "failed":
      if (action.type === "cancel") {
        return { step: "idle" };
      }
      return action.type === "confirm" ? { step: "deleting" } : state;
    case "done":
      return state;
  }
}

// The text of the red button in the confirmation.
export function confirmLabel(state: DeleteState): string {
  switch (state.step) {
    case "deleting":
      return "Deleting...";
    case "failed":
      return "Try again";
    case "done":
      return "Deleted";
    default:
      return "Yes, delete it";
  }
}

export function doneMessage(outcome: DeleteOutcome): string {
  return outcome === "deleted"
    ? "Deleted. Opening the History page..."
    : "This analysis was already deleted. Opening the History page...";
}

// What a screen reader is told when the step changes. An empty text means there is nothing to say.
export function statusText(state: DeleteState): string {
  if (state.step === "deleting") {
    return "Deleting the saved analysis...";
  }
  return state.step === "done" ? doneMessage(state.outcome) : "";
}

// The note on the History page after a deletion.
// The address carries one of two fixed words, "deleted" or "already-gone", and the page shows its own fixed text for each.
// Nothing else from the address is ever shown, so a link cannot put its own text on the page.
export const DELETED_PARAM = "deleted";

// The address of the History page with the note. The word after the equals sign is one of the two outcomes.
export function deletedPath(outcome: DeleteOutcome): string {
  return `${AFTER_DELETE_PATH}?${DELETED_PARAM}=${outcome}`;
}

// Reads the "deleted" part of the address. Next.js gives a text, a list of texts when the part is repeated, or nothing.
// Only the first value counts, and only the two known words. Any other value gives null, and the page shows no note.
export function readDeletedOutcome(value: string | string[] | undefined): DeleteOutcome | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "deleted" || first === "already-gone" ? first : null;
}

// The text of the note on the History page.
export function deletedNoteText(outcome: DeleteOutcome): string {
  return outcome === "deleted"
    ? "The saved analysis was deleted from the server. Your original file was not changed."
    : "That analysis was already deleted from the server, so nothing more was removed.";
}

// Like statusText, for the Delete button in a row of the History list. That page loads the same list again
// and does not open another page, so the text says "the list" and not "the History page".
export function rowStatusText(state: DeleteState): string {
  if (state.step === "deleting") {
    return "Deleting the saved analysis...";
  }
  if (state.step === "done") {
    return state.outcome === "deleted"
      ? "Deleted. Reloading the list..."
      : "This analysis was already deleted. Reloading the list...";
  }
  return "";
}

// The texts of the box on the upload page that deletes the copy which the server saved against the choice of the person.
// That page stays open after the deletion, so the texts say that the analysis stays on it.
export function copyDoneMessage(outcome: DeleteOutcome): string {
  return outcome === "deleted"
    ? "Deleted. The server no longer has a saved copy. The analysis stays on this page until you leave it."
    : "The server no longer had a saved copy, because it was already deleted. The analysis stays on this page until you leave it.";
}

// Like statusText, for that box.
export function copyStatusText(state: DeleteState): string {
  if (state.step === "deleting") {
    return "Deleting the saved copy...";
  }
  return state.step === "done" ? copyDoneMessage(state.outcome) : "";
}
