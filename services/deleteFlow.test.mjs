import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const {
  AFTER_DELETE_PATH,
  DELETED_PARAM,
  START_STATE,
  confirmLabel,
  deletedNoteText,
  deletedPath,
  doneMessage,
  nextDeleteState,
  readDeletedOutcome,
  rowStatusText,
  statusText,
} = await import("./deleteFlow.ts");

const ACTIONS = [
  { type: "ask" },
  { type: "cancel" },
  { type: "confirm" },
  { type: "succeeded", outcome: "deleted" },
  { type: "failed", message: "It went wrong." },
];

const STATES = {
  idle: { step: "idle" },
  confirming: { step: "confirming" },
  deleting: { step: "deleting" },
  failed: { step: "failed", message: "It went wrong." },
  done: { step: "done", outcome: "deleted" },
};

// For every step: the actions that change something, and the step they lead to. Every other action must change nothing.
const ALLOWED = {
  idle: { ask: "confirming" },
  confirming: { cancel: "idle", confirm: "deleting" },
  deleting: { succeeded: "done", failed: "failed" },
  failed: { cancel: "idle", confirm: "deleting" },
  done: {},
};

function freezeAll(value) {
  return Object.freeze({ ...value });
}

describe("nextDeleteState", () => {
  it("starts with the button only: nothing is asked and nothing is sent", () => {
    assert.deepEqual(START_STATE, { step: "idle" });
  });

  it("goes from the button, to the question, to deleting, to done", () => {
    let state = START_STATE;
    state = nextDeleteState(state, { type: "ask" });
    assert.deepEqual(state, { step: "confirming" });
    state = nextDeleteState(state, { type: "confirm" });
    assert.deepEqual(state, { step: "deleting" });
    state = nextDeleteState(state, { type: "succeeded", outcome: "deleted" });
    assert.deepEqual(state, { step: "done", outcome: "deleted" });
  });

  it("keeps the outcome when the analysis was already gone", () => {
    const state = nextDeleteState(STATES.deleting, { type: "succeeded", outcome: "already-gone" });
    assert.deepEqual(state, { step: "done", outcome: "already-gone" });
  });

  it("goes back to the button when the person cancels the question", () => {
    const asked = nextDeleteState(START_STATE, { type: "ask" });
    assert.deepEqual(nextDeleteState(asked, { type: "cancel" }), { step: "idle" });
  });

  it("keeps the message of a failure, and lets the person try again or give up", () => {
    const failed = nextDeleteState(STATES.deleting, { type: "failed", message: "Could not reach the server." });
    assert.deepEqual(failed, { step: "failed", message: "Could not reach the server." });
    assert.deepEqual(nextDeleteState(failed, { type: "confirm" }), { step: "deleting" });
    assert.deepEqual(nextDeleteState(failed, { type: "cancel" }), { step: "idle" });
  });

  it("can fail, try again and then succeed", () => {
    let state = nextDeleteState(START_STATE, { type: "ask" });
    state = nextDeleteState(state, { type: "confirm" });
    state = nextDeleteState(state, { type: "failed", message: "x" });
    state = nextDeleteState(state, { type: "confirm" });
    state = nextDeleteState(state, { type: "succeeded", outcome: "deleted" });
    assert.deepEqual(state, { step: "done", outcome: "deleted" });
  });

  it("changes a step only with the actions that belong to it, and returns the same state for every other action", () => {
    for (const [step, state] of Object.entries(STATES)) {
      for (const action of ACTIONS) {
        const result = nextDeleteState(state, action);
        const target = ALLOWED[step][action.type];
        if (target === undefined) {
          assert.equal(result, state, `${step} + ${action.type} must change nothing`);
        } else {
          assert.equal(result.step, target, `${step} + ${action.type} must lead to ${target}`);
        }
      }
    }
  });

  it("does not send a second request while the first one runs: confirm, ask and cancel are ignored", () => {
    for (const type of ["confirm", "ask", "cancel"]) {
      assert.equal(nextDeleteState(STATES.deleting, { type }), STATES.deleting);
    }
  });

  it("does not delete without the question: confirm is ignored on the button", () => {
    assert.equal(nextDeleteState(STATES.idle, { type: "confirm" }), STATES.idle);
    assert.equal(nextDeleteState(STATES.idle, { type: "succeeded", outcome: "deleted" }), STATES.idle);
  });

  it("does nothing once the analysis is deleted", () => {
    for (const action of ACTIONS) {
      assert.equal(nextDeleteState(STATES.done, action), STATES.done);
    }
  });

  it("ignores an action it does not know", () => {
    for (const state of Object.values(STATES)) {
      assert.equal(nextDeleteState(state, { type: "something-else" }), state);
    }
  });

  it("does not change the state it was given", () => {
    for (const state of Object.values(STATES)) {
      const frozen = freezeAll(state);
      const copy = { ...frozen };
      for (const action of ACTIONS) {
        nextDeleteState(frozen, action);
      }
      assert.deepEqual(frozen, copy);
    }
  });
});

describe("confirmLabel", () => {
  it("says what the red button does in each step", () => {
    assert.equal(confirmLabel(STATES.confirming), "Yes, delete it");
    assert.equal(confirmLabel(STATES.deleting), "Deleting...");
    assert.equal(confirmLabel(STATES.failed), "Try again");
    assert.equal(confirmLabel(STATES.done), "Deleted");
  });

  it("uses the text of the question for the button step too", () => {
    assert.equal(confirmLabel(STATES.idle), "Yes, delete it");
  });
});

describe("doneMessage and statusText", () => {
  it("tells the two outcomes apart", () => {
    assert.equal(doneMessage("deleted"), "Deleted. Opening the History page...");
    assert.equal(doneMessage("already-gone"), "This analysis was already deleted. Opening the History page...");
  });

  it("says something to a screen reader only while deleting and when done", () => {
    assert.equal(statusText(STATES.idle), "");
    assert.equal(statusText(STATES.confirming), "");
    assert.equal(statusText(STATES.deleting), "Deleting the saved analysis...");
    assert.equal(statusText(STATES.failed), "");
    assert.equal(statusText(STATES.done), "Deleted. Opening the History page...");
    assert.equal(statusText({ step: "done", outcome: "already-gone" }), "This analysis was already deleted. Opening the History page...");
  });

  it("does not repeat the message of a failure, which is shown as an alert", () => {
    assert.equal(statusText(STATES.failed).includes("went wrong"), false);
  });
});

describe("AFTER_DELETE_PATH", () => {
  it("is the History page", () => {
    assert.equal(AFTER_DELETE_PATH, "/dashboard");
  });
});

describe("deletedPath", () => {
  it("is the History page with the outcome in the address", () => {
    assert.equal(deletedPath("deleted"), "/dashboard?deleted=deleted");
    assert.equal(deletedPath("already-gone"), "/dashboard?deleted=already-gone");
  });

  it("starts with the address of the History page, and uses the name DELETED_PARAM", () => {
    assert.equal(DELETED_PARAM, "deleted");
    for (const outcome of ["deleted", "already-gone"]) {
      assert.ok(deletedPath(outcome).startsWith(AFTER_DELETE_PATH + "?"));
      assert.equal(new URL(deletedPath(outcome), "http://localhost:3000").searchParams.get(DELETED_PARAM), outcome);
    }
  });
});

describe("readDeletedOutcome", () => {
  it("reads the two known words", () => {
    assert.equal(readDeletedOutcome("deleted"), "deleted");
    assert.equal(readDeletedOutcome("already-gone"), "already-gone");
  });

  it("gives back what deletedPath wrote, for both outcomes", () => {
    for (const outcome of ["deleted", "already-gone"]) {
      const value = new URL(deletedPath(outcome), "http://localhost:3000").searchParams.get(DELETED_PARAM);
      assert.equal(readDeletedOutcome(value ?? undefined), outcome);
    }
  });

  it("gives null when there is no value", () => {
    assert.equal(readDeletedOutcome(undefined), null);
    assert.equal(readDeletedOutcome(""), null);
    assert.equal(readDeletedOutcome([]), null);
  });

  it("gives null for every other text, even a small change of a known word", () => {
    const others = ["Deleted", "DELETED", "deleted ", " deleted", "delete", "already_gone", "already-gone ", "true", "1", "x", "<b>deleted</b>", "deleted<script>", "__proto__", "constructor", "toString", "%64eleted"];
    for (const value of others) {
      assert.equal(readDeletedOutcome(value), null, JSON.stringify(value));
    }
  });

  it("uses only the first value when the address repeats the name", () => {
    assert.equal(readDeletedOutcome(["deleted", "already-gone"]), "deleted");
    assert.equal(readDeletedOutcome(["already-gone", "deleted"]), "already-gone");
    assert.equal(readDeletedOutcome(["deleted", "x"]), "deleted");
    assert.equal(readDeletedOutcome(["x", "deleted"]), null);
    assert.equal(readDeletedOutcome(["", "deleted"]), null);
  });

  it("never gives back any text of the address, only one of the two words or null", () => {
    for (const value of ["deleted", "already-gone", "anything else", ["a", "b"], undefined]) {
      const result = readDeletedOutcome(value);
      assert.ok(result === null || result === "deleted" || result === "already-gone");
    }
  });
});

describe("deletedNoteText", () => {
  it("tells the two outcomes apart, in plain words", () => {
    assert.equal(deletedNoteText("deleted"), "The saved analysis was deleted from the server. Your original file was not changed.");
    assert.equal(deletedNoteText("already-gone"), "That analysis was already deleted from the server, so nothing more was removed.");
  });

  it("is plain text without markup, and the two texts differ", () => {
    assert.notEqual(deletedNoteText("deleted"), deletedNoteText("already-gone"));
    for (const outcome of ["deleted", "already-gone"]) {
      assert.doesNotMatch(deletedNoteText(outcome), /[<>&]/);
      assert.doesNotMatch(deletedNoteText(outcome), /undefined|null/);
    }
  });
});

describe("rowStatusText", () => {
  it("says something to a screen reader only while deleting and when done", () => {
    assert.equal(rowStatusText(STATES.idle), "");
    assert.equal(rowStatusText(STATES.confirming), "");
    assert.equal(rowStatusText(STATES.deleting), "Deleting the saved analysis...");
    assert.equal(rowStatusText(STATES.failed), "");
    assert.equal(rowStatusText(STATES.done), "Deleted. Reloading the list...");
    assert.equal(rowStatusText({ step: "done", outcome: "already-gone" }), "This analysis was already deleted. Reloading the list...");
  });

  it("talks about the list and not about the History page, because the person is already there", () => {
    for (const state of [STATES.deleting, STATES.done, { step: "done", outcome: "already-gone" }]) {
      assert.doesNotMatch(rowStatusText(state), /History/);
    }
  });

  it("does not repeat the message of a failure, which is shown as an alert", () => {
    assert.equal(rowStatusText(STATES.failed).includes("went wrong"), false);
  });

  it("differs from statusText only in the second half of the done texts", () => {
    assert.equal(rowStatusText(STATES.deleting), statusText(STATES.deleting));
    assert.notEqual(rowStatusText(STATES.done), statusText(STATES.done));
  });
});
