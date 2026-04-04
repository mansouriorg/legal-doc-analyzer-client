// app/error.tsx
"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // You could log this to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Something went wrong!</h2>
      <button
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        onClick={() => reset()} // Attempts to re-render the page
      >
        Try again
      </button>
    </div>
  );
}