import Link from "next/link";
import {
  HISTORY_PATH,
  MAX_SEARCH_LENGTH,
  RISK_CHOICES,
  RISK_PARAM,
  SEARCH_PARAM,
  describeFilterResult,
  isFiltering,
  searchScopeNote,
} from "@/services/history";
import type { HistoryFilter } from "@/services/history";

interface HistoryFilterFormProps {
  // What the address asks for now (see readHistoryFilter in services/history.ts).
  filter: HistoryFilter;
  // How many analyses the filter leaves, out of how many are in the list.
  shown: number;
  listed: number;
  // How many saved analyses are not in the list at all, because the server sends only the newest ones.
  hidden: number;
}

// The search of the History page. It is a plain form that opens the page again with the choices in the address,
// so it works without JavaScript, and the address can be bookmarked or shared.
export default function HistoryFilterForm({ filter, shown, listed, hidden }: HistoryFilterFormProps) {
  const filtering = isFiltering(filter);
  const scopeNote = searchScopeNote(listed, hidden);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form action={HISTORY_PATH} method="get" role="search" aria-label="Search the saved analyses" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="history-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search by file name
          </label>
          <input
            id="history-search"
            name={SEARCH_PARAM}
            type="search"
            defaultValue={filter.query}
            maxLength={MAX_SEARCH_LENGTH}
            autoComplete="off"
            placeholder="For example: lease"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500"
          />
        </div>
        <div className="sm:w-64">
          <label htmlFor="history-risk" className="mb-1 block text-sm font-medium text-slate-700">
            Risk
          </label>
          <select
            id="history-risk"
            name={RISK_PARAM}
            defaultValue={filter.risk ?? ""}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
          >
            <option value="">All analyses</option>
            {RISK_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            Search
          </button>
          {filtering ? (
            <Link href={HISTORY_PATH} className="text-sm font-medium text-blue-700 underline hover:text-blue-800">
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      {filtering ? <p className="mt-3 text-sm text-slate-600">{describeFilterResult(shown, listed)}</p> : null}
      {scopeNote === null ? null : <p className="mt-3 text-sm text-slate-600">{scopeNote}</p>}
    </div>
  );
}
