
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { QuizQuestion, LearningStep } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const parseJsonResponse = <T>(responseText: string): T => {
    let jsonStr = responseText.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        jsonStr = match[1];
    }
    try {
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Failed to parse JSON response:", jsonStr);
        throw new Error("Invalid JSON format received from the API.");
    }
};


export const summarizeText = async (text: string): Promise<{ point: string; source: string; }[]> => {
    if (!text.trim()) return [];
    // Prompt updated to strictly limit to top 5 key concepts and short length
    const prompt = `Analyze the following text and create a structured summary of the top 3 to 5 most critical key concepts (maximum). Do not summarize everything, only the most important parts.
    
    For each point:
    1. Provide a concise description (maximum 7 lines).
    2. Provide the verbatim source quote from the text that supports it. 
    3. It is critical to extract and include any mathematical formulas or LaTeX code exactly as they appear in the text within the relevant summary points.

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
                          description: "An array of 3-5 key concept summary points.",
                          items: {
                              type: Type.OBJECT,
                              properties: {
                                  point: { type: Type.STRING, description: "The Markdown-formatted summary point (max 7 lines), including any exact formulas." },
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
        const result = parseJsonResponse<{ summary: { point: string; source: string; }[] }>(response.text);
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
  const prompt = `Analyze the following lecture transcript and notes. Identify the top 5 most important, visually representable keywords or short concepts (2-3 words max).\n\nTEXT:\n"""${text}"""`;
  
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
                        description: "A list of the top 5 most important keywords or short concepts.",
                        items: {
                            type: Type.STRING,
                        },
                    },
                },
                required: ["keywords"],
            },
        },
    });

    const result = parseJsonResponse<{ keywords: string[] }>(response.text);
    return result.keywords || [];
  } catch (error) {
    console.error("Error extracting keywords:", error);
    throw new Error("Failed to extract keywords.");
  }
};

export const generateVisualForKeyword = async (keyword: string, context: string): Promise<string> => {
    const prompt = `Generate a high-quality, visually engaging image for the concept: "${keyword}". The image should be a photorealistic, real-world example or a clear, detailed diagram. **Do not use simple icons, abstract shapes, or generic clip art.** The goal is a rich visual aid that enhances understanding. If the concept includes a mathematical formula (e.g., $E=mc^2$), render it clearly and accurately within the visual. The image must have a white background. Use the following context for accuracy.\n\nCONTEXT:\n"""${context}"""`;
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
        const result = parseJsonResponse<{ quiz: QuizQuestion[] }>(response.text);
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
        const result = parseJsonResponse<{ roadmap: LearningStep[], suggestedGoal: string }>(response.text);
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
        const result = parseJsonResponse<{ folderId: string }>(response.text);
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

export const generateNotepadsFromText = async (text: string, count: number): Promise<{ title: string; content: string; }[]> => {
    if (!text.trim() || count <= 0) return [];
    // Limit to max 5 distinct concepts, short content
    const prompt = `Analyze the provided text and identify the top ${Math.min(count, 5)} most critical key concepts. 
    Create a summary card for each.
    Each card must have a concise title and a short paragraph of summary content (maximum 7 lines).

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
                        notes: {
                            type: Type.ARRAY,
                            description: `An array of up to 5 key concept summary notes.`,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "A concise title for the note." },
                                    content: { type: Type.STRING, description: "The summary content (max 7 lines)." }
                                },
                                required: ["title", "content"]
                            }
                        }
                    },
                    required: ["notes"]
                }
            }
        });
        const result = parseJsonResponse<{ notes: { title: string; content: string; }[] }>(response.text);
        return result.notes || [];
    } catch (error) {
        console.error("Error generating notepads:", error);
        throw new Error("Failed to generate notepads.");
    }
};

export const categorizeTranscriptSegment = async (text: string): Promise<string> => {
    if (text.trim().length < 20) return 'General';
    const prompt = `Categorize the following short transcript segment into a single 1-3 word topic label (e.g., "Introduction", "Thermodynamics", "Q&A", "Logistics").

TEXT:
"""${text}"""`;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim().replace(/["']/g, ''); 
    } catch (error) {
        return 'General';
    }
};

export const summarizeTranscriptSegment = async (text: string): Promise<string> => {
    if (text.trim().length < 30) return '';
    // Improved prompt for structured, useful summaries (Concepts, Definitions, Examples)
    const prompt = `Create a "Smart Summary" of the following lecture segment. 
    Do NOT just repeat the text. Instead, identify the core concept being discussed and format it as follows using Markdown:
    
    **Concept Name**
    *   **Definition:** [A concise 1-sentence explanation]
    *   **Key Insight/Example:** [A brief real-world analogy or example mentioned, or a key takeaway]

    Keep it very concise.

    TEXT: """${text}"""`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim();
    } catch (error) {
        return '';
    }
};

export const formatTranscriptSegment = async (text: string): Promise<string> => {
    if (text.trim().length < 20) return text;
    // Improved prompt for cleaning up transcription errors (stumbling, repetition)
    const prompt = `You are an expert transcription editor. Clean up the following raw speech-to-text output.
    1.  **Remove Disfluencies:** Eliminate repeated words, stumbling, false starts, and filler words (like "um", "uh", "like", "you know").
    2.  **Fix Grammar:** Correct basic grammatical errors while maintaining the speaker's original voice and intent.
    3.  **Format:** Use Markdown to bold key terms and add paragraph breaks where natural pauses occur.
    
    Do not summarize. Output the full cleaned text.

    RAW TEXT:
    """${text}"""`;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        return response.text.trim();
    } catch (error) {
        return text;
    }
};

export const performAiAction = async (action: 'example' | 'explain' | 'connect' | 'check', text: string): Promise<string> => {
    let prompt = "";
    switch (action) {
        case 'example':
            prompt = `Create a concrete, easy-to-understand example for the following concept. Use a real-world analogy if possible.\n\nCONCEPT:\n"""${text}"""`;
            break;
        case 'explain':
            prompt = `Explain the following concept in simple terms, as if teaching a beginner. Highlight the 'why' and 'how'.\n\nCONCEPT:\n"""${text}"""`;
            break;
        case 'connect':
            prompt = `Identify connections between the following text and broader themes or related concepts. How does this fit into the bigger picture?\n\nTEXT:\n"""${text}"""`;
            break;
        case 'check':
            prompt = `Critique the following text. Is it accurate? Are there any logical fallacies or missing important nuances? Provide a brief double-check analysis.\n\nTEXT:\n"""${text}"""`;
            break;
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
        });
        return response.text;
    } catch (error) {
        console.error(`Error performing AI action ${action}:`, error);
        throw new Error(`Failed to perform ${action}.`);
    }
};

export const recognizeHandwriting = async (imageBase64: string): Promise<string> => {
    const prompt = `Transcribe the handwriting in this image into text.
    - If the image contains mathematical formulas, equations, or symbols, STRICTLY use LaTeX format enclosed in single dollar signs (e.g. $E=mc^2$).
    - If it contains diagrams or drawings, describe them briefly in brackets [Diagram of...].
    - Maintain the original structure and line breaks where possible.
    - If it's just text, return standard text.
    - Do not add any conversational filler, just return the transcribed content.`;

    try {
        // Strip the data:image/png;base64, prefix if present
        const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Data } },
                    { text: prompt }
                ],
            },
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error recognizing handwriting:", error);
        throw new Error("Failed to recognize handwriting.");
    }
};
