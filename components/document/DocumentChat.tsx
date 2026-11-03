"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { FormEvent } from "react";
import { askDocumentQuestion } from "@/services/api";
import {
  MAX_QUESTION_LENGTH,
  START_STATE,
  SUGGESTED_QUESTIONS,
  checkQuestion,
  formatWaited,
  historyToSend,
  nextChatState,
  settle,
} from "@/services/chatFlow";

interface DocumentChatProps {
  // The id the server gave to the saved analysis.
  documentId: string;
}

interface MessageBubbleProps {
  role: "user" | "ai";
  content: string;
}

// One message. The text is shown as plain text, never as HTML, and line breaks are kept.
function MessageBubble({ role, content }: MessageBubbleProps) {
  const mine = role === "user";
  const shape = mine
    ? "rounded-br-none bg-blue-600 text-white"
    : "rounded-bl-none border border-slate-200 bg-slate-100 text-slate-800";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p className={`max-w-[85%] whitespace-pre-wrap wrap-break-word rounded-2xl px-4 py-2 text-sm ${shape}`}>
        <span className="sr-only">{mine ? "You: " : "Assistant: "}</span>
        {content}
      </p>
    </div>
  );
}

// How long the person has waited for the answer, shown next to "Working on an answer...".
// It is its own component and is in the page only while a question runs, so the count starts at 0 for each question,
// and only this small part is drawn again every second.
function WaitedTime() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // The time is read from the clock each time and not counted tick by tick, because a browser slows down the timers of a tab in the background.
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Hidden from screen readers, which would read out a new number every second.
  return <span aria-hidden="true"> ({formatWaited(seconds)})</span>;
}

// A box where the person asks questions about one saved analysis.
// The questions and answers live in this component only: nothing is saved, and reloading the page starts again.
export default function DocumentChat({ documentId }: DocumentChatProps) {
  const [state, dispatch] = useReducer(nextChatState, START_STATE);
  const [draft, setDraft] = useState("");
  const headingId = useId();
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  // The request that is running. It is null when none runs, and also after the person has stopped it.
  const requestRef = useRef<AbortController | null>(null);
  // After a stop, the focus moves to "Try again", because the button that was clicked is gone.
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusRetry = useRef(false);

  // Keeps the newest message in view. Only the box scrolls, never the whole page.
  useEffect(() => {
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [state.messages.length, state.step]);

  // Leaving the page, or opening another document, stops the request that is still running.
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, []);

  // After a stop the red box appears, and the focus goes to "Try again".
  useEffect(() => {
    if (state.step === "failed" && focusRetry.current) {
      retryRef.current?.focus();
    }
    focusRetry.current = false;
  }, [state.step]);

  async function ask(text: string) {
    // A second question while the first one is running does nothing.
    if (state.step === "asking" || requestRef.current !== null || checkQuestion(text) !== null) {
      return;
    }

    const question = text.trim();
    const controller = new AbortController();
    requestRef.current = controller;
    dispatch({ type: "ask", question });

    const action = await settle(() =>
      askDocumentQuestion(documentId, question, historyToSend(state.messages), controller.signal),
    );

    // The person may have stopped this question, or left the page, while the server worked. Then this result is no longer wanted.
    if (requestRef.current !== controller) {
      return;
    }
    requestRef.current = null;
    dispatch(action);
  }

  // Stops the waiting for the running question. The red box then shows the question, so that the person can try it again.
  function stop() {
    const controller = requestRef.current;
    if (controller === null) {
      return;
    }

    // The ref is cleared first, so that the result of this request is ignored when it comes in.
    requestRef.current = null;
    controller.abort();
    focusRetry.current = true;
    dispatch({ type: "stopped" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step === "asking" || checkQuestion(draft) !== null) {
      return;
    }

    const text = draft;
    setDraft("");
    await ask(text);
  }

  // Asks one of the suggested questions, in the same way as a typed one.
  // The buttons are gone as soon as the question runs, so the focus moves first to the list of messages, where the waiting text and its stop button appear.
  async function askSuggested(question: string) {
    listRef.current?.focus();
    await ask(question);
  }

  const asking = state.step === "asking";
  const canSend = asking === false && draft.trim() !== "";

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 id={headingId} className="text-lg font-bold text-slate-900">
          Ask about this analysis
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Answers come only from the saved summary, clauses and notes, not from the whole contract. They can be wrong and are not legal advice.
          Each question is sent to the server together with this saved analysis. Your questions are not saved: reloading the page clears them.
        </p>
      </div>

      {/* A log: a screen reader reads out each new message as it appears. The height is fixed, so the input does not move down (and out of view) when messages come. */}
      <div ref={listRef} role="log" aria-label="Questions and answers" tabIndex={-1} className="h-80 space-y-3 overflow-y-auto px-4 py-4">
        {state.messages.length === 0 && asking === false ? (
          <p className="text-sm text-slate-500">
            No answers yet. Type a question below, or choose one of these:
          </p>
        ) : null}

        {state.messages.length === 0 && asking === false ? (
          <ul aria-label="Suggested questions" className="flex flex-col items-start gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <li key={question} className="max-w-full">
                <button
                  type="button"
                  onClick={() => askSuggested(question)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-left text-sm font-medium text-blue-800 shadow-sm transition-colors hover:bg-blue-100"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {state.messages.map((message) => (
          <MessageBubble key={message.id} role={message.role} content={message.content} />
        ))}

        {asking ? <MessageBubble role="user" content={state.question} /> : null}

        {asking ? (
          <div className="flex justify-start">
            <p className="max-w-[85%] rounded-2xl rounded-bl-none border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-600">
              <span className="animate-pulse motion-reduce:animate-none">Working on an answer...</span>
              <WaitedTime />
              <span className="block text-xs text-slate-500">A small model can take a minute or more. Please keep this page open.</span>
              <button
                type="button"
                onClick={stop}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Stop waiting
              </button>
            </p>
          </div>
        ) : null}
      </div>

      {state.step === "failed" ? (
        <div role="alert" className="mx-4 mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 wrap-break-word">
          <p>
            <span className="font-semibold">Your question was not answered.</span> {state.message}
          </p>
          <p className="mt-1 line-clamp-3 text-red-800">&ldquo;{state.question}&rdquo;</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              ref={retryRef}
              type="button"
              onClick={() => ask(state.question)}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "dismiss" })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3">
        <label htmlFor={inputId} className="sr-only">
          Your question
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_QUESTION_LENGTH}
          autoComplete="off"
          placeholder="Ask about this contract..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={canSend === false}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
        >
          {asking ? "Asking..." : "Send"}
        </button>
      </form>
    </section>
  );
}
