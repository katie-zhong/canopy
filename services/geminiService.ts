import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { QuizQuestion, LearningStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const summarizeText = async (text: string): Promise<{ point: string; source: string; }[]> => {
    if (!text.trim()) return [];
    const prompt = `Analyze the following text and create a structured summary of its key points. For each point, provide the verbatim source quote from the text that supports it.

TEXT:
"""${text}"""`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [{ text: prompt }] },
          config: {
              responseMimeType: "application/json",
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      summary: {
                          type: Type.ARRAY,
                          description: "An array of summary points with their sources.",
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  point: { type: Type.STRING, description: "The Markdown-formatted summary point." },
                                  source: { type: Type.STRING, description: "The exact source text from the input." }
                              },
                              required: ["point", "source"]
                          }
                      }
                  },
                  required: ["summary"]
              }
          }
        });
        const result = JSON.parse(response.text.trim());
        return result.summary || [];

    } catch (error) {
        console.error("Error summarizing text:", error);
        throw new Error("Failed to summarize text.");
    }
};

export const findExternalSource = async (conceptText: string): Promise<{ title: string; uri: string } | null> => {
    const prompt = `Find a single, high-quality, and authoritative external web reference (like a university page, documentation, or encyclopedia) for the following concept.
    CONCEPT:
    """${conceptText}"""`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                tools: [{googleSearch: {}}],
            },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks && groundingChunks.length > 0) {
            const webChunk = groundingChunks.find(chunk => chunk.web);
            if (webChunk && webChunk.web) {
                return {
                    title: webChunk.web.title || 'External Source',
                    uri: webChunk.web.uri,
                };
            }
        }
        return null;
    } catch (error) {
        console.error("Error finding external source:", error);
        throw new Error("Failed to find external source.");
    }
};


export const extractKeywords = async (text: string): Promise<string[]> => {
  if (!text.trim()) {
    return [];
  }
  const prompt = `Analyze the following lecture transcript and notes. Identify the top 8 most important, visually representable keywords or short concepts (2-3 words max).\n\nTEXT:\n"""${text}"""`;
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    keywords: {
                        type: Type.ARRAY,
                        description: "A list of the top 8 most important keywords or short concepts.",
                        items: {
                            type: Type.STRING,
                        },
                    },
                },
                required: ["keywords"],
            },
        },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result.keywords || [];
  } catch (error) {
    console.error("Error extracting keywords:", error);
    throw new Error("Failed to extract keywords.");
  }
};

export const generateVisualForKeyword = async (keyword: string, context: string): Promise<string> => {
    const prompt = `Generate a visually engaging and educationally meaningful diagram or illustration for the concept: "${keyword}". Do not just create a simple icon. The visual should explain the concept, show a process, or provide an example. Use clear labels if necessary. The style must be clean, modern, and suitable for a digital whiteboard (e.g., minimalist, flat design). Ensure the background is white. If the concept involves a mathematical formula or LaTeX code (like $E=mc^2$), render it accurately and legibly within the image. Context from the lecture is provided below to aid understanding: """${context}"""`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
            }
        }
        throw new Error("No image data returned from API.");

    } catch (error) {
        console.error(`Error generating visual for "${keyword}":`, error);
        throw new Error(`Failed to generate visual for "${keyword}".`);
    }
};

export const generateQuiz = async (text: string): Promise<QuizQuestion[]> => {
    if (!text.trim()) return [];
    const prompt = `Generate a 4-question quiz based on the following text. The quiz should help a student test their understanding. Include a mix of question types: one multiple-choice, one true/false, one fill-in-the-blank, and one 'correct the statement'. For each question, provide the question text, options (if applicable), the correct answer, and a brief explanation for the answer.\n\nTEXT:\n"""${text}"""`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quiz: {
                            type: Type.ARRAY,
                            description: "An array of quiz questions.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['multiple-choice', 'true-false', 'fill-in-the-blank', 'correct-the-statement'] },
                                    question: { type: Type.STRING },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    statement: { type: Type.STRING, description: "The incorrect statement to be corrected."},
                                    answer: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                },
                                required: ["type", "question", "answer", "explanation"]
                            }
                        }
                    },
                    required: ["quiz"]
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        return result.quiz || [];
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error("Failed to generate quiz.");
    }
};

export const generateLearningRoadmap = async (text: string): Promise<{ steps: LearningStep[], suggestedGoal: string }> => {
    if (!text.trim()) return { steps: [], suggestedGoal: '' };
    const prompt = `Based on the following text, create a conceptual learning roadmap and suggest a study goal. 
1.  **Roadmap**: Identify key concepts and arrange them in a logical step-by-step order for a beginner. For each step, provide the concept name and a brief one-sentence description.
2.  **Study Goal**: Based on the text, suggest a concise, actionable study goal for the user.

TEXT:
"""${text}"""`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        roadmap: {
                            type: Type.ARRAY,
                            description: "An array of learning steps.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    step: { type: Type.NUMBER },
                                    concept: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["step", "concept", "description"]
                            }
                        },
                        suggestedGoal: {
                            type: Type.STRING,
                            description: "A suggested study goal based on the text."
                        }
                    },
                    required: ["roadmap", "suggestedGoal"]
                }
            }
        });
        const result = JSON.parse(response.text.trim());
        const steps = (result.roadmap || []).sort((a: LearningStep, b: LearningStep) => a.step - b.step);
        return { steps, suggestedGoal: result.suggestedGoal || '' };
    } catch (error) {
        console.error("Error generating learning roadmap:", error);
        throw new Error("Failed to generate learning roadmap.");
    }
};


export const generateTitleForText = async (text: string): Promise<string> => {
    if (text.trim().length < 50) return '';
    const prompt = `Generate a concise and descriptive title (5 words max) for the following text. The title should capture the main topic. Do not include quotes or labels. Just return the title text.\n\nTEXT:\n"""${text}"""`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim().replace(/["']/g, ''); // Clean up quotes
    } catch (error) {
        console.error("Error generating title:", error);
        return '';
    }
};

export const categorizeSession = async (text: string, folders: {id: string, name: string}[]): Promise<string | null> => {
    if (!text.trim() || folders.length === 0) {
        return null;
    }
    const folderListString = folders.map(f => `- ${f.name} (id: ${f.id})`).join('\n');
    const prompt = `Read the following text from a study session. Based on its content, which of the following course folders is the best fit? Respond with only the ID of the most relevant folder. If none of the folders are a good match, respond with the string "null".

TEXT:
"""
${text}
"""

AVAILABLE FOLDERS:
${folderListString}
`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        folderId: {
                            type: Type.STRING,
                            description: "The ID of the best-fit folder, or the string 'null' if none match.",
                        },
                    },
                    required: ["folderId"],
                },
            },
        });
        const result = JSON.parse(response.text.trim());
        const returnedId = result.folderId;
        if (returnedId && returnedId !== 'null' && folders.some(f => f.id === returnedId)) {
            return returnedId;
        }
        return null;
    } catch (error) {
        console.error("Error categorizing session:", error);
        return null;
    }
};