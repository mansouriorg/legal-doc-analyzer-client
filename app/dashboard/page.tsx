import Link from "next/link";
import HistoryFilterForm from "@/components/document/HistoryFilterForm";
import HistoryRowActions from "@/components/document/HistoryRowActions";
import LocalTime from "@/components/document/LocalTime";
import { listDocuments } from "@/services/api";
import { AFTER_DELETE_PATH, DELETED_PARAM, deletedNoteText, readDeletedOutcome } from "@/services/deleteFlow";
import { HISTORY_PATH, filterHistory, readHistoryFilter, reportPath, riskBadges, summarizeHistory } from "@/services/history";
import type { HistoryStats } from "@/services/history";
import type { DeleteOutcome, DocumentList, DocumentSummary, RiskLevel } from "@/types";

// The list changes whenever a document is analyzed, so the page asks the server on every visit.
// Without this line the build could read the list once and keep showing it.
export const dynamic = "force-dynamic";

const BADGE_COLORS: Record<RiskLevel, string> = {
  High: "bg-red-100 text-red-800 border-red-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function FileIcon() {
  return (
    <svg className="w-5 h-5 shrink-0 text-slate-400" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
  );
}

// The risk labels of one row. The parent decides how they are laid out.
function RiskBadges({ doc }: { doc: DocumentSummary }) {
  const badges = riskBadges(doc);

  if (badges.length === 0) {
    return (
      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">
        No clauses
      </span>
    );
  }

  return (
    <>
      {badges.map((badge) => (
        <span key={badge.level} className={`px-2 py-1 text-xs font-bold rounded-md border ${BADGE_COLORS[badge.level]}`}>
          {badge.text}
        </span>
      ))}
    </>
  );
}

// The time is shown on the clock of the person (see LocalTime). A time that cannot be used shows "Unknown date".
function SavedTime({ value }: { value: string }) {
  return <LocalTime value={value} fallback="Unknown date" />;
}

// The name is only for screen readers, so that the links do not all sound the same.
function ReportLink({ doc }: { doc: DocumentSummary }) {
  return (
    <Link href={reportPath(doc.id)} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">
      View Report<span className="sr-only"> for {doc.documentName}</span> &rarr;
    </Link>
  );
}

// Shown after an analysis was deleted. The text is fixed: the address only chooses between two texts.
function DeletedNote({ outcome }: { outcome: DeleteOutcome }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      <p className="font-medium">{deletedNoteText(outcome)}</p>
      <Link href={AFTER_DELETE_PATH} className="font-semibold underline hover:text-emerald-950">
        Dismiss
      </Link>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-semibold">The saved analyses could not be loaded.</p>
      <p className="mt-1 wrap-break-word">{message}</p>
      <p className="mt-1">Reload this page to try again.</p>
    </div>
  );
}

function EmptyHistory() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No analyses yet</h2>
      <p className="text-slate-500 mt-1 text-sm">Each analysis that the server saves appears here. An analysis you chose not to keep is not saved, so it is not listed.</p>
      <Link
        href="/"
        className="mt-5 inline-block bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors"
      >
        Analyze a document
      </Link>
    </div>
  );
}

// Shown when a search or a risk choice leaves no analysis.
function NoMatches() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No analysis matches</h2>
      <p className="text-slate-500 mt-1 text-sm">Try fewer words, another risk choice, or show all analyses.</p>
      <Link href={HISTORY_PATH} className="mt-4 inline-block text-sm font-medium text-blue-700 underline hover:text-blue-800">
        Show all analyses
      </Link>
    </div>
  );
}

// Notes about the list itself: rows that are not shown, and files that could not be read.
function HistoryNotes({ stats }: { stats: HistoryStats }) {
  return (
    <>
      {stats.hidden > 0 ? (
        <div role="note" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Not all analyses are shown.</span> The list shows {stats.listed} of {stats.total} saved analyses, because the server sends only the newest ones. The two risk numbers above count only the analyses shown.
        </div>
      ) : null}
      {stats.unreadable > 0 ? (
        <div role="note" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">{stats.unreadable === 1 ? "One saved file could not be read." : `${stats.unreadable} saved files could not be read.`}</span> {stats.unreadable === 1 ? "It is" : "They are"} not in this list. The server writes the name of its folder in its log when it starts.
        </div>
      ) : null}
    </>
  );
}

// Stats Cards: a compact line each on small screens, a tall card each from md up
function StatCards({ stats }: { stats: HistoryStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 mb-8">
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 md:block">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Saved Analyses</p>
        <p className="text-3xl font-bold text-slate-900 md:mt-2">{stats.total}</p>
      </div>
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 flex items-center justify-between gap-3 md:block">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">High Risk Clauses Found</p>
        <p className="text-3xl font-bold text-red-600 md:mt-2">{stats.highRisks}</p>
      </div>
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 flex items-center justify-between gap-3 md:block">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Documents With High Risk</p>
        <p className="text-3xl font-bold text-amber-600 md:mt-2">{stats.withHighRisk}</p>
      </div>
    </div>
  );
}

// The saved analyses: one card each below the lg size, a table from the lg size up.
function HistoryList({ rows }: { rows: DocumentSummary[] }) {
  return (
    <>
      {/* Below the lg size the table does not fit, so each document is a card */}
      <ul className="lg:hidden bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-200 overflow-hidden">
        {rows.map((doc) => (
          <li key={doc.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <FileIcon />
              <div className="min-w-0">
                <p className="font-medium text-slate-900 text-sm wrap-break-word">{doc.documentName}</p>
                <p className="text-xs text-slate-500 mt-0.5"><SavedTime value={doc.savedAt} /></p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadges doc={doc} />
            </div>
            <HistoryRowActions documentId={doc.id} documentName={doc.documentName} align="start">
              <ReportLink doc={doc} />
            </HistoryRowActions>
          </li>
        ))}
      </ul>

      {/* History Table: from the lg size up */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">Saved analyses, newest first</caption>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th scope="col" className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Name</th>
                <th scope="col" className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Analyzed</th>
                <th scope="col" className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Profile</th>
                <th scope="col" className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <FileIcon />
                      <span className="font-medium text-slate-900 text-sm wrap-anywhere">{doc.documentName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500 whitespace-nowrap">
                    <SavedTime value={doc.savedAt} />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2 whitespace-nowrap">
                      <RiskBadges doc={doc} />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <HistoryRowActions documentId={doc.id} documentName={doc.documentName} align="end">
                      <ReportLink doc={doc} />
                    </HistoryRowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

interface DashboardProps {
  // Next.js gives the part of the address after the question mark as a promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Dashboard({ searchParams }: DashboardProps) {
  const params = await searchParams;
  const deleted = readDeletedOutcome(params[DELETED_PARAM]);
  const filter = readHistoryFilter(params);
  let list: DocumentList | null = null;
  let loadError = "";

  try {
    list = await listDocuments();
  } catch (error) {
    console.error("Failed to load the saved analyses:", error);
    loadError = error instanceof Error ? error.message : "The saved analyses could not be loaded.";
  }

  const stats = list === null ? null : summarizeHistory(list);
  const rows = list === null ? [] : list.documents;
  const shown = filterHistory(rows, filter);

  return (
    <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* Page Header: stacked on small screens, side by side from the sm size up */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Document History</h1>
          <p className="text-slate-500 mt-1 text-sm">
            The analyses that the server saved are listed here. Open one again to read its clauses and risks.
          </p>
        </div>
        <Link
          href="/"
          className="self-start sm:self-auto shrink-0 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Upload New Document
        </Link>
      </div>

      {deleted === null ? null : <DeletedNote outcome={deleted} />}

      {stats === null ? (
        <LoadError message={loadError} />
      ) : (
        <>
          <StatCards stats={stats} />
          <HistoryNotes stats={stats} />
          {rows.length === 0 ? (
            <EmptyHistory />
          ) : (
            <>
              <HistoryFilterForm filter={filter} shown={shown.length} listed={rows.length} hidden={stats.hidden} />
              {shown.length === 0 ? <NoMatches /> : <HistoryList rows={shown} />}
            </>
          )}
        </>
      )}
    </main>
  );
}
