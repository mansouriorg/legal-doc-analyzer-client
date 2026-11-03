// app/error.tsx
"use client"; // Error boundaries must be Client Components

import Link from "next/link";
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
    <div className="flex-grow flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h2>
      <p className="text-slate-600 mb-6 max-w-md">
        The page could not be shown. You can try again, or go back to the start page.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => reset()} // Attempts to re-render the page
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2 bg-white text-slate-700 font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          Back to the start page
        </Link>
      </div>
    </div>
  );
}
