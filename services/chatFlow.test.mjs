import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Node 22.18 or newer can import a .ts file directly (it strips the types).
const {
  EMPTY_ANSWER_TEXT,
  HISTORY_SENT,
  MAX_HISTORY_CONTENT,
  MAX_QUESTION_LENGTH,
  NOT_ANSWERED_TEXT,
  START_STATE,
  STOPPED_TEXT,
  checkQuestion,
  formatWaited,
  historyToSend,
  nextChatState,
  settle,
} = await import("./chatFlow.ts");

const OLD = [
  { id: 1, role: "user", content: "What is the term?" },
  { id: 2, role: "ai", content: "One year." },
];

const STATES = {
  idle: { step: "idle", messages: OLD, question: "", message: "", nextId: 3 },
  asking: { step: "asking", messages: OLD, question: "And the fee?", message: "", nextId: 3 },
  failed: { step: "failed", messages: OLD, question: "And the fee?", message: "Could not reach the server.", nextId: 3 },
};

const ACTIONS = [
  { type: "ask", question: "A new question?" },
  { type: "answered", answer: "An answer." },
  { type: "failed", message: "It went wrong." },
  { type: "stopped" },
  { type: "dismiss" },
];

// For every step: the actions that change something, and the step they lead to. Every other action must change nothing.
const ALLOWED = {
  idle: { ask: "asking" },
  asking: { answered: "idle", failed: "failed", stopped: "failed" },
  failed: { ask: "asking", dismiss: "idle" },
};

function deepFreeze(value) {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe("nextChatState", () => {
  it("starts empty: no messages, nothing asked", () => {
    assert.deepEqual(START_STATE, { step: "idle", messages: [], question: "", message: "", nextId: 1 });
  });

  it("goes from idle, to asking, to idle with the question and its answer as two messages", () => {
    let state = nextChatState(START_STATE, { type: "ask", question: "What is the term?" });
    assert.equal(state.step, "asking");
    assert.equal(state.question, "What is the term?");
    assert.deepEqual(state.messages, []);
    state = nextChatState(state, { type: "answered", answer: "One year." });
    assert.deepEqual(state, {
      step: "idle",
      messages: [
        { id: 1, role: "user", content: "What is the term?" },
        { id: 2, role: "ai", content: "One year." },
      ],
      question: "",
      message: "",
      nextId: 3,
    });
  });

  it("keeps the earlier messages in order, and gives every message its own id", () => {
    let state = START_STATE;
    for (const n of [1, 2, 3]) {
      state = nextChatState(state, { type: "ask", question: `Q${n}` });
      state = nextChatState(state, { type: "answered", answer: `A${n}` });
    }
    assert.deepEqual(state.messages.map((m) => m.content), ["Q1", "A1", "Q2", "A2", "Q3", "A3"]);
    assert.deepEqual(state.messages.map((m) => m.role), ["user", "ai", "user", "ai", "user", "ai"]);
    assert.deepEqual(state.messages.map((m) => m.id), [1, 2, 3, 4, 5, 6]);
  });

  it("trims the question that it keeps", () => {
    const state = nextChatState(START_STATE, { type: "ask", question: "  What is the term?\n " });
    assert.equal(state.question, "What is the term?");
  });

  it("ignores a question that cannot be sent: empty, only spaces, or too long", () => {
    for (const question of ["", "   ", "\n\t", "q".repeat(MAX_QUESTION_LENGTH + 1)]) {
      assert.equal(nextChatState(START_STATE, { type: "ask", question }), START_STATE);
      assert.equal(nextChatState(STATES.failed, { type: "ask", question }), STATES.failed);
    }
    const longest = "q".repeat(MAX_QUESTION_LENGTH);
    assert.equal(nextChatState(START_STATE, { type: "ask", question: longest }).step, "asking");
  });

  it("does not add a message when the question fails, and keeps the question and the reason", () => {
    const failed = nextChatState(STATES.asking, { type: "failed", message: "Could not reach the server." });
    assert.deepEqual(failed, STATES.failed);
    assert.equal(failed.messages.length, 2);
  });

  it("lets the person try again with the same question, and then get the answer", () => {
    let state = nextChatState(STATES.failed, { type: "ask", question: STATES.failed.question });
    assert.equal(state.step, "asking");
    assert.equal(state.message, "");
    state = nextChatState(state, { type: "answered", answer: "Two euros." });
    assert.deepEqual(state.messages.slice(-2).map((m) => m.content), ["And the fee?", "Two euros."]);
  });

  it("drops the question that failed when the person asks something else", () => {
    const state = nextChatState(STATES.failed, { type: "ask", question: "Something else?" });
    assert.equal(state.question, "Something else?");
    const done = nextChatState(state, { type: "answered", answer: "Fine." });
    assert.equal(done.messages.some((m) => m.content === "And the fee?"), false);
  });

  it("goes back to idle when the person dismisses a failure, and forgets the question", () => {
    const state = nextChatState(STATES.failed, { type: "dismiss" });
    assert.deepEqual(state, { ...STATES.idle });
  });

  it("changes a step only with the actions that belong to it, and returns the same state for every other action", () => {
    for (const [step, state] of Object.entries(STATES)) {
      for (const action of ACTIONS) {
        const result = nextChatState(state, action);
        const target = ALLOWED[step][action.type];
        if (target === undefined) {
          assert.equal(result, state, `${step} + ${action.type} must change nothing`);
        } else {
          assert.equal(result.step, target, `${step} + ${action.type} must lead to ${target}`);
        }
      }
    }
  });

  it("does not send a second question while the first one runs: ask and dismiss are ignored", () => {
    assert.equal(nextChatState(STATES.asking, { type: "ask", question: "Another?" }), STATES.asking);
    assert.equal(nextChatState(STATES.asking, { type: "dismiss" }), STATES.asking);
  });

  it("does not make up an answer: answered and failed are ignored when nothing was asked", () => {
    for (const step of ["idle", "failed"]) {
      assert.equal(nextChatState(STATES[step], { type: "answered", answer: "Surprise." }), STATES[step]);
    }
    assert.equal(nextChatState(STATES.idle, { type: "failed", message: "x" }), STATES.idle);
  });

  it("ignores an action it does not know", () => {
    for (const state of Object.values(STATES)) {
      assert.equal(nextChatState(state, { type: "something-else" }), state);
    }
  });

  it("does not change the state or the list it was given", () => {
    for (const state of Object.values(STATES)) {
      const frozen = deepFreeze(structuredClone(state));
      const copy = structuredClone(frozen);
      for (const action of ACTIONS) {
        nextChatState(frozen, action);
      }
      assert.deepEqual(frozen, copy);
    }
    const asking = deepFreeze(structuredClone(STATES.asking));
    const answered = nextChatState(asking, { type: "answered", answer: "x" });
    assert.notEqual(answered.messages, asking.messages);
    assert.equal(asking.messages.length, 2);
  });
});

describe("checkQuestion", () => {
  it("accepts a question, with spaces around it", () => {
    assert.equal(checkQuestion("What is the term?"), null);
    assert.equal(checkQuestion("  What is the term?  "), null);
  });

  it("asks for a question when there is none", () => {
    for (const text of ["", " ", "\n", " \t \n "]) {
      assert.equal(checkQuestion(text), "Write a question first.");
    }
  });

  it("accepts the longest question and refuses a longer one, without counting the spaces around it", () => {
    assert.equal(MAX_QUESTION_LENGTH, 1000);
    assert.equal(checkQuestion("q".repeat(1000)), null);
    assert.equal(checkQuestion(`  ${"q".repeat(1000)}  `), null);
    assert.equal(checkQuestion("q".repeat(1001)), "The question is too long: at most 1000 characters.");
  });
});

describe("historyToSend", () => {
  function conversation(pairs) {
    const messages = [];
    for (let n = 1; n <= pairs; n += 1) {
      messages.push({ id: n * 2 - 1, role: "user", content: `Q${n}` }, { id: n * 2, role: "ai", content: `A${n}` });
    }
    return messages;
  }

  it("sends nothing for a conversation that has not started", () => {
    assert.deepEqual(historyToSend([]), []);
  });

  it("sends only the role and the content, oldest first, and no id", () => {
    assert.deepEqual(historyToSend(OLD), [
      { role: "user", content: "What is the term?" },
      { role: "ai", content: "One year." },
    ]);
    for (const turn of historyToSend(OLD)) {
      assert.deepEqual(Object.keys(turn), ["role", "content"]);
    }
  });

  it("sends only the latest messages, starting with a question", () => {
    assert.equal(HISTORY_SENT, 6);
    const sent = historyToSend(conversation(5));
    assert.deepEqual(sent.map((turn) => turn.content), ["Q3", "A3", "Q4", "A4", "Q5", "A5"]);
    assert.equal(sent[0].role, "user");
    assert.equal(historyToSend(conversation(3)).length, 6);
    assert.equal(historyToSend(conversation(2)).length, 4);
  });

  it("never sends more than the server accepts", () => {
    assert.ok(HISTORY_SENT <= 20);
    assert.equal(historyToSend(conversation(50)).length, HISTORY_SENT);
  });

  it("cuts a message that is too long for the server", () => {
    assert.equal(MAX_HISTORY_CONTENT, 4000);
    const long = [{ id: 1, role: "ai", content: "S" + "y".repeat(MAX_HISTORY_CONTENT + 500) + "E" }];
    assert.equal(historyToSend(long)[0].content.length, MAX_HISTORY_CONTENT);
    const exact = [{ id: 1, role: "ai", content: "y".repeat(MAX_HISTORY_CONTENT) }];
    assert.equal(historyToSend(exact)[0].content.length, MAX_HISTORY_CONTENT);
  });

  it("keeps the beginning of a message that is cut, not the end", () => {
    const long = [{ id: 1, role: "ai", content: "Start" + "y".repeat(MAX_HISTORY_CONTENT) + "End" }];
    const sent = historyToSend(long)[0].content;
    assert.ok(sent.startsWith("Start"));
    assert.equal(sent.includes("End"), false);
  });

  it("does not change the list it was given", () => {
    const frozen = deepFreeze(structuredClone(conversation(5)));
    const copy = structuredClone(frozen);
    historyToSend(frozen);
    assert.deepEqual(frozen, copy);
  });
});

describe("settle", () => {
  it("turns an answer into the answered action, without the spaces around it", async () => {
    assert.deepEqual(await settle(async () => ({ answer: "  One year.\n" })), { type: "answered", answer: "One year." });
  });

  it("turns an error into the failed action with its message", async () => {
    const action = await settle(async () => {
      throw new Error("Could not reach the server at http://localhost:3001.");
    });
    assert.deepEqual(action, { type: "failed", message: "Could not reach the server at http://localhost:3001." });
  });

  it("has texts of its own that say what happened", () => {
    assert.equal(NOT_ANSWERED_TEXT, "The server did not answer the question.");
    assert.equal(EMPTY_ANSWER_TEXT, "The server answered, but the answer has no text.");
  });

  it("uses its own text when the error has no message, or is not an error", async () => {
    for (const thrown of [new Error(""), new Error("   "), "text", null, undefined, 42]) {
      const action = await settle(async () => {
        throw thrown;
      });
      assert.deepEqual(action, { type: "failed", message: NOT_ANSWERED_TEXT });
    }
  });

  it("does not call an empty or missing answer an answer", async () => {
    for (const result of [{ answer: "" }, { answer: "   " }, { answer: 5 }, {}]) {
      const action = await settle(async () => result);
      assert.deepEqual(action, { type: "failed", message: EMPTY_ANSWER_TEXT });
    }
  });

  it("never throws, also when the request throws at once", async () => {
    const action = await settle(() => {
      throw new Error("at once");
    });
    assert.deepEqual(action, { type: "failed", message: "at once" });
  });

  it("starts the request once", async () => {
    let started = 0;
    await settle(async () => {
      started += 1;
      return { answer: "x" };
    });
    assert.equal(started, 1);
  });
});

describe("stopping a question", () => {
  it("has a text of its own that says what the person did", () => {
    assert.equal(STOPPED_TEXT, "You stopped waiting for the answer.");
  });

  it("turns the running question into a failed one with that text, and keeps the question", () => {
    const stopped = nextChatState(STATES.asking, { type: "stopped" });
    assert.deepEqual(stopped, { ...STATES.asking, step: "failed", message: STOPPED_TEXT });
    assert.equal(stopped.question, "And the fee?");
    assert.equal(stopped.messages, STATES.asking.messages);
  });

  it("does not make the stopped question a message of the conversation, so it is never sent as history", () => {
    const stopped = nextChatState(STATES.asking, { type: "stopped" });
    assert.equal(stopped.messages.length, 2);
    assert.equal(historyToSend(stopped.messages).some((turn) => turn.content === "And the fee?"), false);
  });

  it("does nothing when no question runs", () => {
    assert.equal(nextChatState(STATES.idle, { type: "stopped" }), STATES.idle);
    assert.equal(nextChatState(STATES.failed, { type: "stopped" }), STATES.failed);
  });

  it("lets the person try the same question again, and then get the answer", () => {
    let state = nextChatState(STATES.asking, { type: "stopped" });
    state = nextChatState(state, { type: "ask", question: state.question });
    assert.equal(state.step, "asking");
    assert.equal(state.message, "");
    state = nextChatState(state, { type: "answered", answer: "Two euros." });
    assert.deepEqual(state.messages.slice(-2).map((m) => m.content), ["And the fee?", "Two euros."]);
  });

  it("ignores an answer or an error that comes in after the stop", () => {
    const stopped = nextChatState(STATES.asking, { type: "stopped" });
    assert.equal(nextChatState(stopped, { type: "answered", answer: "Late." }), stopped);
    assert.equal(nextChatState(stopped, { type: "failed", message: "Late." }), stopped);
  });

  it("can be dismissed like any other failure", () => {
    const stopped = nextChatState(STATES.asking, { type: "stopped" });
    assert.deepEqual(nextChatState(stopped, { type: "dismiss" }), STATES.idle);
  });
});

describe("formatWaited", () => {
  it("writes the seconds up to 59", () => {
    assert.equal(formatWaited(0), "0 s");
    assert.equal(formatWaited(1), "1 s");
    assert.equal(formatWaited(12), "12 s");
    assert.equal(formatWaited(59), "59 s");
  });

  it("writes minutes and seconds from 60 on", () => {
    assert.equal(formatWaited(60), "1 min 0 s");
    assert.equal(formatWaited(65), "1 min 5 s");
    assert.equal(formatWaited(125), "2 min 5 s");
    assert.equal(formatWaited(600), "10 min 0 s");
    assert.equal(formatWaited(3599), "59 min 59 s");
    assert.equal(formatWaited(3600), "60 min 0 s");
    assert.equal(formatWaited(7325), "122 min 5 s");
  });

  it("drops the fraction of a second", () => {
    assert.equal(formatWaited(12.9), "12 s");
    assert.equal(formatWaited(59.99), "59 s");
    assert.equal(formatWaited(60.5), "1 min 0 s");
  });

  it("counts anything that is not a usable number of seconds as 0", () => {
    for (const value of [-1, -60, 0.4, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, null, "12"]) {
      assert.equal(formatWaited(value), "0 s", String(value));
    }
  });
});
