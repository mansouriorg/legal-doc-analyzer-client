// components/document/UploadZone.tsx
"use client";

import { useState } from "react";
import { MAX_UPLOAD_MB, validateUploadFile } from "@/services/uploadRules";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelect, selectedFile, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // One place that checks a file, so clicking and dropping behave the same way.
  const acceptFile = (file: File) => {
    const message = validateUploadFile(file);
    if (message === null) {
      setProblem(null);
      onFileSelect(file);
    } else {
      setProblem(message);
    }
  };

  // Handle standard click-to-upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosenFile = e.target.files?.[0];
    if (chosenFile) {
      acceptFile(chosenFile);
    }
  };

  // Prevent default browser behavior (opening the file in a new tab)
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Visual feedback when a file is hovering over the drop zone
  const handleDragIn = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled === false) setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // Handle the actual drop event
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files.length > 0) {
      acceptFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <div
        data-upload-zone
        className={`border-2 border-dashed rounded-xl text-center transition-all duration-200 group relative
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer hover:bg-slate-50'}
          ${isDragging ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-slate-300 hover:border-blue-400'}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Visually hidden but still reachable with the keyboard (Tab, then Enter or Space) */}
        <input
          type="file"
          id="file-upload"
          className="sr-only"
          accept=".pdf,.docx"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <label
          htmlFor="file-upload"
          className={`flex flex-col items-center justify-center space-y-4 p-12 ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
        >
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-50'}`}>
            <svg
              className={`w-10 h-10 ${selectedFile || isDragging ? 'text-blue-600' : 'text-slate-500'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div className="text-slate-700 font-medium text-lg">
            {selectedFile ? (
              <span className="text-blue-600 font-semibold">{selectedFile.name}</span>
            ) : isDragging ? (
              <span className="text-blue-600 font-semibold">Drop the document here</span>
            ) : (
              <span>Click to browse or drag and drop</span>
            )}
          </div>

          <p className="text-sm text-slate-500">
            Supports PDF and DOCX (Max {MAX_UPLOAD_MB} MB)
          </p>
        </label>

        {/* Invisible overlay to prevent flickering when dragging over text/icons inside the div */}
        {isDragging && <div className="absolute inset-0 z-10" />}
      </div>

      {problem !== null ? (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {selectedFile ? `${problem} The file you chose before is still selected.` : problem}
        </p>
      ) : null}
    </div>
  );
}
