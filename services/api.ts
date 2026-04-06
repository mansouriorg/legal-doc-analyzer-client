// services/api.ts
import { DocumentAnalysis } from "@/types"; // Using the types we created earlier

const API_BASE_URL = "http://localhost:3001"; // Your NestJS server port

export async function analyzeDocument(file: File): Promise<DocumentAnalysis> {
  const formData = new FormData();
  formData.append("document", file);

  try {
    // NOTE: This fetch is ready for your NestJS backend.
    // If the backend isn't running yet, this will fail and fall into the catch block.
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    
    // FOR DEVELOPMENT: Returning mock data so you can test the UI immediately 
    // before the NestJS backend is fully built.
    console.log("Returning mock data for UI testing...");
    return {
      documentName: file.name,
      executiveSummary: "This document is a standard Non-Disclosure Agreement (NDA). It heavily favors the disclosing party and restricts the receiving party from engaging in competitive business for a period of 2 years.",
      clauses: [
        {
          id: "1",
          title: "Confidentiality Obligations",
          originalText: "The Receiving Party agrees to maintain strictly confidential all Information and not to disclose it to any third party without prior written consent.",
          riskLevel: "Low",
          explanation: "Standard confidentiality requirement. Ensure your team has secure data handling practices in place."
        },
        {
          id: "2",
          title: "Non-Compete Clause",
          originalText: "The Receiving Party shall not directly or indirectly engage in any business that competes with the Disclosing Party for a period of 24 months globally.",
          riskLevel: "High",
          explanation: "Highly restrictive. This prevents you from working in the same industry globally for 2 years after signing."
        },
        {
          id: "3",
          title: "Governing Law",
          originalText: "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.",
          riskLevel: "Medium",
          explanation: "Standard, but requires you to understand or hire counsel familiar with Delaware law in case of a dispute."
        }
      ]
    };
  }
}