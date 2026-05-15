import { notFound } from 'next/navigation';
// Adjust these import paths based on your actual alias setup (e.g., using @/ or ../../)
import AnalysisResults from '../../../components/document/AnalysisResults';
import { getDocumentById } from '../../../services/api'; 

interface DocumentPageProps {
  params: {
    id: string;
  };
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  // In Next.js App Router, the folder name [id] becomes the parameter
  const documentId = params.id;

  try {
    // 1. Fetch the specific document's analysis from your backend
    const documentData = await getDocumentById(documentId);

    // 2. If the document doesn't exist, trigger the Next.js 404 page
    if (!documentData) {
      notFound();
    }

    // 3. Render the page using your existing AnalysisResults component
    return (
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Analysis Report
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Document ID: {documentId} • Retrieved securely
          </p>
        </div>

        {/* Pass the fetched data to your client component. 
          Make sure AnalysisResults is expecting this data prop! 
        */}
        <AnalysisResults data={documentData} />
      </main>
    );

  } catch (error) {
    console.error(`Failed to fetch document ${documentId}:`, error);
    
    // This will either render this fallback UI or get caught by your app/error.tsx boundary
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-semibold text-red-600 mb-2">
          Unable to load document
        </h2>
        <p className="text-gray-600">
          There was an error retrieving the analysis for this legal document. It may have been deleted or you might lack permissions.
        </p>
      </div>
    );
  }
}