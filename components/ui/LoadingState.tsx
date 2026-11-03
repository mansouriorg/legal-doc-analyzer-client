import { useState, useEffect } from "react";

// The lines below only describe what the analysis does. They do not show real progress,
// so this screen has no progress bar.
export default function LoadingState() {
  const loadingSteps = [
    "Reading document structure...",
    "Extracting raw text and formatting...",
    "Identifying key legal clauses...",
    "Evaluating obligations and liabilities...",
    "Calculating risk severity...",
    "Generating executive summary...",
    "Finalizing report..."
  ];

  const [currentStep, setCurrentStep] = useState(0);

  // Cycle through the loading steps every 1.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        // Stop cycling if we reach the last message
        if (prev === loadingSteps.length - 1) return prev;
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [loadingSteps.length]);

  return (
    <div className="w-full py-16 flex flex-col items-center justify-center space-y-6">
      {/* Screen readers get one steady message instead of the lines that keep changing */}
      <p role="status" className="sr-only">Analyzing the document. Please wait.</p>

      {/* Animated Spinner (it stands still for people whose system asks for less motion) */}
      <div className="relative flex items-center justify-center" aria-hidden="true">
        <div className="absolute w-20 h-20 border-4 border-slate-100 rounded-full"></div>
        <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin motion-reduce:animate-none"></div>
        {/* Inner pulsing dot */}
        <div className="absolute w-4 h-4 bg-blue-600 rounded-full animate-pulse motion-reduce:animate-none"></div>
      </div>

      {/* Dynamic Text */}
      <div className="text-center h-16" aria-hidden="true">
        <h3 className="text-xl font-bold text-slate-800 mb-2 animate-pulse motion-reduce:animate-none">
          Analyzing Document
        </h3>
        <p className="text-sm font-medium text-slate-500">
          {loadingSteps[currentStep]}
        </p>
      </div>

      <p className="text-sm text-slate-500 text-center">
        Please keep this page open until the analysis is ready. A long document can take a minute or more.
      </p>
    </div>
  );
}
