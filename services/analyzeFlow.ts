// services/analyzeFlow.ts
// The words that the upload page shows around stopping an analysis. They are here and not in the page, so that the tests can read them
// (the Node test runner cannot run a .tsx file).

// The hint under the button that stops the analysis.
export const STOP_HINT = "If you stop, the server is asked to cancel the analysis. Leaving this page does the same.";

// The first line of the notice that the upload page shows after a stop.
export const STOPPED_TITLE = "The analysis was stopped.";

// The second line. The page keeps the file, so the person can start again with one click.
export const STOPPED_NEXT = 'Your file is still selected. Click "Analyze Document" to start again, or choose another file.';

// The third line, only when the person did not tick "Do not keep this analysis". A server that has the stop drops the analysis when the browser
// drops the request, but it may have been almost done, and an older server finishes the analysis and saves it in any case.
export const STOPPED_MAYBE_SAVED =
  "The server may still have saved a copy, for example if it was almost done. If so, you can delete it in the History list.";

// The lines of the notice, the title first. askedToKeep is true when the box "Do not keep this analysis" was not ticked.
export function stoppedNotice(askedToKeep: boolean): string[] {
  return askedToKeep ? [STOPPED_TITLE, STOPPED_NEXT, STOPPED_MAYBE_SAVED] : [STOPPED_TITLE, STOPPED_NEXT];
}
