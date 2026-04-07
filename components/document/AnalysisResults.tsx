import { DocumentAnalysis, RiskLevel } from "@/types";
import { useEffect, useState } from "react";

interface AnalysisResultsProps {
  data: DocumentAnalysis;
  file: File;
  onReset: () => void;
}

export default function AnalysisResults({ data, file, onReset }: AnalysisResultsProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Generate a local URL to preview the uploaded file without needing a backend
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    
    // Cleanup the URL to prevent memory leaks when the component unmounts
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "High": return "bg-red-100 text-red-800 border-red-200";
      case "Medium": return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 flex flex-col h-[85vh]">
      
      {/* Header and Controls */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{data.documentName}</h2>
          <p className="text-slate-500 text-sm mt-1">Analysis Complete</p>
        </div>
        <button 
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
        >
          Analyze Another Document
        </button>
      </div>

      {/* Split View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow overflow-hidden">
        
        {/* Left Column: Document Viewer */}
        <div className="bg-slate-200 rounded-xl overflow-hidden border border-slate-300 shadow-inner flex flex-col">
          <div className="bg-slate-800 px-4 py-2 flex justify-between items-center text-slate-200 text-sm font-medium">
            <span>Original Document</span>
            <span className="text-xs text-slate-400">Preview</span>
          </div>
          <div className="flex-grow w-full h-full bg-white relative">
            {fileUrl ? (
              <iframe 
                src={fileUrl} 
                className="w-full h-full border-none absolute inset-0"
                title="Document Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Loading preview...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Analysis Results (Scrollable) */}
        <div className="flex flex-col overflow-y-auto pr-2 space-y-6 pb-10 custom-scrollbar">
          
          {/* Executive Summary */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-10">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Executive Summary
            </h3>
            <p className="text-slate-700 leading-relaxed text-sm">
              {data.executiveSummary}
            </p>
          </div>

          {/* Clauses List */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">
              Extracted Clauses & Risks
            </h3>
            <div className="space-y-4">
              {data.clauses.map((clause) => (
                <div key={clause.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <h4 className="text-base font-bold text-slate-800">
                      {clause.title}
                    </h4>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskColor(clause.riskLevel)}`}>
                      {clause.riskLevel} Risk
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 border-l-4 border-slate-300">
                    <span className="block font-semibold text-slate-700 text-xs uppercase mb-1">Original Text:</span>
                    "{clause.originalText}"
                  </div>
                  
                  <div className="mt-1">
                    <span className="block font-semibold text-slate-700 text-xs uppercase mb-1">AI Implication:</span>
                    <span className="text-sm text-slate-700">{clause.explanation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}