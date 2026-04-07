"use client";

import { useState } from "react";
import { analyzeDocument } from "@/services/api";
import { DocumentAnalysis } from "@/types";
import AnalysisResults from "@/components/document/AnalysisResults";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisData, setAnalysisData] = useState<DocumentAnalysis | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      // Reset the previous analysis if the user selects a new file
      setAnalysisData(null); 
    }
  };

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

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:bg-slate-50 hover:border-blue-500 transition-colors duration-200 group">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center justify-center space-y-4"
            >
              {/* Upload Icon (Inline SVG) */}
              <svg
                className={`w-16 h-16 ${file ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              
              <div className="text-slate-700 font-medium text-lg">
                {file ? (
                  <span className="text-blue-600 font-semibold">{file.name}</span>
                ) : (
                  <span>Click to browse or drag and drop</span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Supports PDF, DOC, and DOCX (Max 10MB)
              </p>
            </label>
          </div>

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