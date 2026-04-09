"use client";

import Link from "next/link";

// Mock data representing documents processed in the past
const documentHistory = [
  {
    id: "doc_101",
    name: "Vendor_Agreement_TechCorp.pdf",
    date: "April 8, 2026",
    highRisks: 2,
    mediumRisks: 4,
    status: "Completed",
  },
  {
    id: "doc_102",
    name: "NDA_Freelance_Contractor.docx",
    date: "April 5, 2026",
    highRisks: 0,
    mediumRisks: 1,
    status: "Completed",
  },
  {
    id: "doc_103",
    name: "Office_Lease_Agreement_Q3.pdf",
    date: "April 2, 2026",
    highRisks: 1,
    mediumRisks: 2,
    status: "Completed",
  },
  {
    id: "doc_104",
    name: "Software_Licensing_Global.pdf",
    date: "March 28, 2026",
    highRisks: 3,
    mediumRisks: 5,
    status: "Review Required", // Example of a different status
  },
];

export default function Dashboard() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Page Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Document History</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Review past analyses and track risk profiles across your agreements.
          </p>
        </div>
        <Link 
          href="/"
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Upload New Document
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Documents</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">124</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">High Risk Clauses Found</p>
          <p className="text-3xl font-bold text-red-600 mt-2">18</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Pending Reviews</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">3</p>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Document Name</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Analyzed</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Profile</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documentHistory.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      <span className="font-medium text-slate-900 text-sm">{doc.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-500">
                    {doc.date}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                      {doc.highRisks > 0 && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md border border-red-200">
                          {doc.highRisks} High
                        </span>
                      )}
                      {doc.mediumRisks > 0 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md border border-amber-200">
                          {doc.mediumRisks} Med
                        </span>
                      )}
                      {doc.highRisks === 0 && doc.mediumRisks === 0 && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-200">
                          Low Risk
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                      doc.status === 'Completed' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${doc.status === 'Completed' ? 'bg-slate-400' : 'bg-blue-600'}`}></span>
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors">
                      View Report &rarr;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}