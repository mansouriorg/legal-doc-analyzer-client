// services/chatFlow.ts
// The steps of asking questions about a saved analysis, written as plain data and a few functions.
// The chat component only draws the current state, so the rules can be tested without a browser.
import type { ChatTurn } from "@/services/api";

// The longest question. The server refuses a longer one with a 400, so the box does not let the person type more.
export const MAX_QUESTION_LENGTH = 1000;

// How many of the latest messages go to the server with a question, and how long each one may be.
// The server itself uses only the latest 6, and refuses more than 20 messages or a message of more than 4000 characters.
export const HISTORY_SENT = 6;
export const MAX_HISTORY_CONTENT = 4000;

// Shown when a failure has no text of its own.
export const NOT_ANSWERED_TEXT = "The server did not answer the question.";
export const EMPTY_ANSWER_TEXT = "The server answered, but the answer has no text.";

// Shown when the person stops waiting for the answer.
export const STOPPED_TEXT = "You stopped waiting for the answer.";

// Questions that the person can ask with one click while the conversation is empty. They are written to fit most contracts, and they are
// answered from the saved summary, clauses and notes like any other question. The tests check each one with checkQuestion.
export const SUGGESTED_QUESTIONS: readonly string[] = [
  "What are the biggest risks in this document?",
  "Explain this document in simple words.",
  "Which clauses should I read most carefully before signing?",
  "What obligations does this document create, and for whom?",
];

export interface ChatMessage {
  // Only used as the key of the message in the page.
  id: number;
  role: ChatTurn["role"];
  content: string;
}

export interface ChatState {
  step: "idle" | "asking" | "failed";
  // The questions that were answered, each followed by its answer. The oldest first.
  messages: ChatMessage[];
  // The question that is being asked, or the one that was not answered. Empty when idle.
  question: string;
  // Why the question was not answered. Empty unless the step is "failed".
  message: string;
  // The id of the next message.
  nextId: number;
}

export type ChatAction =
  | { type: "ask"; question: string }
  | { type: "answered"; answer: string }
  | { type: "failed"; message: string }
  | { type: "stopped" }
  | { type: "dismiss" };

export const START_STATE: ChatState = { step: "idle", messages: [], question: "", message: "", nextId: 1 };

// Checks a question before it is sent. Returns the reason why it cannot be sent, or null when it can.
export function checkQuestion(text: string): string | null {
  const question = text.trim();
  if (question === "") {
    return "Write a question first.";
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return `The question is too long: at most ${MAX_QUESTION_LENGTH} characters.`;
  }
  return null;
}

// Gives the next state. An action that does not fit the current step is ignored and the same state comes back.
// That is what stops a second question from being sent while the first one is still running.
// A question that was not answered is not kept as a message: it is dropped when the person asks something else.
export function nextChatState(state: ChatState, action: ChatAction): ChatState {
  if (state.step === "asking") {
    if (action.type === "answered") {
      return {
        step: "idle",
        messages: [
          ...state.messages,
          { id: state.nextId, role: "user", content: state.question },
          { id: state.nextId + 1, role: "ai", content: action.answer },
        ],
        question: "",
        message: "",
        nextId: state.nextId + 2,
      };
    }
    // The person stopped waiting. The question is kept, so that it can be tried again, and it is not a message of the conversation.
    if (action.type === "stopped") {
      return { ...state, step: "failed", message: STOPPED_TEXT };
    }
    return action.type === "failed" ? { ...state, step: "failed", message: action.message } : state;
  }

  if (action.type === "ask") {
    const question = action.question.trim();
    return checkQuestion(question) === null ? { ...state, step: "asking", question, message: "" } : state;
  }

  if (action.type === "dismiss" && state.step === "failed") {
    return { ...state, step: "idle", question: "", message: "" };
  }

  return state;
}

// The earlier messages that go to the server with the next question: the latest ones, each cut to the length
// the server accepts. The question that is being asked is not in the list, and neither is a question that failed.
export function historyToSend(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-HISTORY_SENT).map((message) => ({
    role: message.role,
    content: message.content.slice(0, MAX_HISTORY_CONTENT),
  }));
}

// Runs the request and turns the outcome into the action for nextChatState. It never throws.
export async function settle(request: () => Promise<{ answer: string }>): Promise<ChatAction> {
  try {
    const result = await request();
    if (typeof result.answer !== "string" || result.answer.trim() === "") {
      return { type: "failed", message: EMPTY_ANSWER_TEXT };
    }
    return { type: "answered", answer: result.answer.trim() };
  } catch (error) {
    return {
      type: "failed",
      message: error instanceof Error && error.message.trim() !== "" ? error.message : NOT_ANSWERED_TEXT,
    };
  }
}

// How long the person has waited, for the waiting text: "12 s", or "1 min 5 s" from 60 seconds on.
// A fraction of a second is dropped. A number that is not a usable count of seconds counts as 0.
export function formatWaited(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  if (whole < 60) {
    return `${whole} s`;
  }
  return `${Math.floor(whole / 60)} min ${whole % 60} s`;
}
