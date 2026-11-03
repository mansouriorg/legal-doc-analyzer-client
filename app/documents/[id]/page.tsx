import Link from "next/link";
import { notFound } from "next/navigation";
import AnalysisResults from "@/components/document/AnalysisResults";
import DeleteDocumentButton from "@/components/document/DeleteDocumentButton";
import DocumentChat from "@/components/document/DocumentChat";
import { getDocumentById } from "@/services/api";
import type { DocumentAnalysis } from "@/types";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id: documentId } = await params;

  let documentData: DocumentAnalysis | null = null;
  let loadFailed = false;

  try {
    documentData = await getDocumentById(documentId);
  } catch (error) {
    console.error(`Failed to fetch document ${documentId}:`, error);
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <main className="container mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">
          Unable to load document
        </h2>
        <p className="text-gray-600">
          The server could not be reached or returned an error. Check that the backend is running and that the server address is right (see Changing the server address in the README), then reload this page.
        </p>
      </main>
    );
  }

  // notFound() throws, so it must stay outside the try block above.
  if (documentData === null) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 border-b pb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 print:hidden">
          &larr; Back to history
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Analysis Report
        </h1>
        <p className="text-sm text-gray-500 mt-2 wrap-break-word">
          Document ID: {documentId}
        </p>
        <p className="mt-3 print:hidden">
          <a href="#ask" className="text-sm font-medium text-blue-600 hover:text-blue-800">
            Ask a question about this analysis &darr;
          </a>
        </p>
        <div className="mt-4 print:hidden">
          <DeleteDocumentButton documentId={documentId} documentName={documentData.documentName} />
        </div>
      </div>

      <AnalysisResults data={documentData} />

      <div id="ask" className="mx-auto mt-8 w-full max-w-3xl scroll-mt-20 print:hidden">
        <DocumentChat key={documentId} documentId={documentId} />
      </div>
    </main>
  );
}
