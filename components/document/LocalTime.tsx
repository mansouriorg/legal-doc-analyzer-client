"use client";

import { useSyncExternalStore } from "react";
import { formatLocalTime, formatSavedAt } from "@/services/history";

interface LocalTimeProps {
  // A time that the server sent, such as 2026-10-25T16:30:00.000Z.
  value: string;
  // The text to show when the value is not a usable time. When this is left out, such a value shows nothing.
  fallback?: string;
}

// The time zone of the computer does not change while the page is open, so there is nothing to listen to.
function subscribe(): () => void {
  return () => undefined;
}

// Shows a time on the clock of the person's computer, for example "25 Oct 2026, 17:30 UTC+1".
// The server does not know the time zone of the person. What it sends first, and what the browser draws while it takes over the page,
// is the same time in UTC. React then switches to the local time in the browser, without a warning about a different text.
// Hovering over a local time shows the UTC time.
export default function LocalTime({ value, fallback }: LocalTimeProps) {
  const utcText = formatSavedAt(value);
  const text = useSyncExternalStore(
    subscribe,
    () => formatLocalTime(value),
    () => utcText,
  );

  if (text === null) {
    return fallback === undefined ? null : <>{fallback}</>;
  }

  return (
    <time dateTime={value} title={utcText !== null && utcText !== text ? utcText : undefined}>
      {text}
    </time>
  );
}
