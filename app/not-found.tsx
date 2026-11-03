// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold text-blue-600 mb-2">404</p>
      <h1 className="text-3xl font-bold text-slate-900 mb-3">Page not found</h1>
      <p className="text-slate-600 mb-8 max-w-md">
        We could not find this page or document. It may have been removed, or the link may be wrong.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Back to the start page
      </Link>
    </main>
  );
}
