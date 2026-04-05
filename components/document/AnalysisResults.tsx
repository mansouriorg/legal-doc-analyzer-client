// components/document/AnalysisResults.tsx
import { DocumentAnalysis, RiskLevel } from "@/types";

interface AnalysisResultsProps {
  data: DocumentAnalysis;
}

export default function AnalysisResults({ data }: AnalysisResultsProps) {
  // Helper function to color-code risk badges
  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case "High":
        return "bg-red-100 text-red-800 border-red-200";
      case "Medium":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Low":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 mt-8">
      {/* Executive Summary Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {data.documentName}
        </h2>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Executive Summary
        </h3>
        <p className="text-slate-700 leading-relaxed">
          {data.executiveSummary}
        </p>
      </div>

      {/* Extracted Clauses List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
          Key Clauses & Obligations
        </h3>
        
        {data.clauses.map((clause) => (
          <div 
            key={clause.id} 
            className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col gap-3"
          >
            <div className="flex justify-between items-start">
              <h4 className="text-lg font-semibold text-blue-900">
                {clause.title}
              </h4>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(clause.riskLevel)}`}>
                {clause.riskLevel} Risk
              </span>
            </div>
            
            <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 italic border-l-4 border-slate-300">
              "{clause.originalText}"
            </div>
            
            <div>
              <span className="text-sm font-semibold text-slate-700">Implication: </span>
              <span className="text-sm text-slate-600">{clause.explanation}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}