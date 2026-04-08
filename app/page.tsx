"use client";

import { useState } from "react";
import { analyzeDocument } from "@/services/api";
import { DocumentAnalysis } from "@/types";
import AnalysisResults from "@/components/document/AnalysisResults";
import UploadZone from "@/components/document/UploadZone"; // Import our new component

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysis | null>(null);

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);

    try {
      // Call the API service to process the document
      const result = await analyzeDocument(file);
      
      // Store the result to trigger the UI switch
      setAnalysisData(result);

    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to analyze the document. Please ensure the backend is running.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      
      {/* Show the upload box ONLY if we do not have analysis data yet */}
      {!analysisData ? (
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl p-10 border border-slate-100">
          
          {/* Header Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
              AI Legal Document Analyzer
            </h1>
            <p className="text-lg text-slate-600">
              Upload your contracts and international agreements. Our AI will automatically extract key clauses, obligations, and flag potential risks.
            </p>
          </div>

          {/* New Drag and Drop Upload Zone */}
          <UploadZone 
            onFileSelect={(selectedFile) => {
              setFile(selectedFile);
              setAnalysisData(null); // Reset analysis if they drop a new file
            }} 
            selectedFile={file}
            disabled={isUploading}
          />

          {/* Action Button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
                !file || isUploading
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg"
              }`}
            >
              {isUploading ? "Analyzing Document..." : "Analyze Document"}
            </button>
          </div>

        </div>
      ) : (
        /* Render the AnalysisResults component if we have data */
        <div className="w-full flex-grow flex flex-col">
          <AnalysisResults 
            data={analysisData} 
            file={file!} 
            onReset={() => { 
              // Clear the state to go back to the upload screen
              setAnalysisData(null); 
              setFile(null); 
            }} 
          />
        </div>
      )}

    </main>
  );
}