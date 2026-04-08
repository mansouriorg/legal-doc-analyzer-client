// components/document/UploadZone.tsx
import { useState, useCallback } from "react";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  disabled?: boolean;
}

export default function UploadZone({ onFileSelect, selectedFile, disabled = false }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Handle standard click-to-upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  // Prevent default browser behavior (opening the file in a new tab)
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Visual feedback when a file is hovering over the drop zone
  const handleDragIn = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragOut = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Handle the actual drop event
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Optional: Add quick validation here to ensure it's a doc/pdf
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (validTypes.includes(droppedFile.type)) {
        onFileSelect(droppedFile);
      } else {
        alert("Please upload a valid PDF or Word document.");
      }
      e.dataTransfer.clearData();
    }
  }, [disabled, onFileSelect]);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 group relative
        ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer hover:bg-slate-50'}
        ${isDragging ? 'border-blue-500 bg-blue-50/50 shadow-inner' : 'border-slate-300 hover:border-blue-400'}
      `}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="hidden"
        accept=".pdf,.doc,.docx"
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <label
        htmlFor="file-upload"
        className={`flex flex-col items-center justify-center space-y-4 ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
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
            <span className="text-blue-600 font-semibold">Drop document here!</span>
          ) : (
            <span>Click to browse or drag and drop</span>
          )}
        </div>
        
        <p className="text-sm text-slate-500">
          Supports PDF, DOC, and DOCX (Max 10MB)
        </p>
      </label>
      
      {/* Invisible overlay to prevent flickering when dragging over text/icons inside the div */}
      {isDragging && <div className="absolute inset-0 z-10" />}
    </div>
  );
}