import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Legal Document Analyzer",
  description: "Extract clauses and risks from international agreements using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">

        {/* Top Navigation Bar */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center gap-3 sm:gap-8">

                {/* Logo Area */}
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="bg-blue-600 p-1.5 rounded-lg group-hover:bg-blue-700 transition">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="font-bold text-slate-900 text-xl tracking-tight">Legal<span className="text-blue-600">AI</span></span>
                </Link>

                {/* Nav Links: always visible, with shorter names on small screens */}
                <div className="flex space-x-1 sm:space-x-8 sm:ml-4">
                  <Link href="/" className="text-slate-600 hover:text-blue-600 px-2 sm:px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-blue-600">
                    <span className="sm:hidden">New</span>
                    <span className="hidden sm:inline">New Analysis</span>
                  </Link>
                  <Link href="/dashboard" className="text-slate-600 hover:text-blue-600 px-2 sm:px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-blue-600">
                    <span className="sm:hidden">History</span>
                    <span className="hidden sm:inline">Document History</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </nav>

        {/* Page Content */}
        <div className="flex flex-grow flex-col">
          {children}
        </div>

      </body>
    </html>
  );
}
