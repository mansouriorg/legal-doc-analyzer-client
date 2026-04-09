import { useState, useEffect } from "react";

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
      {/* Animated Spinner */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-20 h-20 border-4 border-slate-100 rounded-full"></div>
        <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        {/* Inner pulsing dot */}
        <div className="absolute w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
      </div>

      {/* Dynamic Text */}
      <div className="text-center h-16">
        <h3 className="text-xl font-bold text-slate-800 mb-2 animate-pulse">
          Analyzing Document
        </h3>
        <p className="text-sm font-medium text-slate-500 transition-all duration-300">
          {loadingSteps[currentStep]}
        </p>
      </div>

      {/* Progress Bar indicator */}
      <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-500 ease-out rounded-full"
          style={{ width: `${((currentStep + 1) / loadingSteps.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}