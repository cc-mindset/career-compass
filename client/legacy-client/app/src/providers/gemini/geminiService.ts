
import { GoogleGenAI, Type } from "@google/genai";

// Career suggestions logic using Gemini SDK.
// Always initialize the SDK right before use to ensure updated configuration.

export const getCareerSuggestions = async (role: string, location: string) => {
  try {
    // Initializing SDK instance immediately before the call as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide 3 personalized career suggestions for a ${role} based in ${location}. Focus on skill gaps, networking, and job opportunities.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["title", "description", "category"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Error fetching career suggestions:", error);
    return [];
  }
};
