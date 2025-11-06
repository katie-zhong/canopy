export enum VisualCardStatus {
  Loading = 'loading',
  Loaded = 'loaded',
  Error = 'error',
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'png' | 'jpeg' | 'other';
  content: string; // Text content for searchable/displayable files
  url?: string; // For images
}

export interface VisualCard {
  id: string;
  type: 'ai' | 'text' | 'image' | 'file';
  keyword: string; // Also used as title for text cards, filename for file cards
  status: VisualCardStatus;
  imageUrl?: string;
  text?: string;
  position: { top: number; left: number };
  rotation: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  fileUrl?: string; // For image/file objects
  sourceText?: string; // For linking summaries back to source
}

export interface Folder {
  id: string;
  name: string;
  date: string;
}

export interface Quiz {
  id: string;
  createdAt: string;
  questions: QuizQuestion[];
}

export interface Roadmap {
  id: string;
  createdAt: string;
  steps: LearningStep[];
  suggestedGoal: string;
}

export interface Chat {
    id:string;
    title: string;
    date: string;
    contextText: string;
    visualCards: VisualCard[];
    studyGoal?: string;
    reminderTime?: string;
    summaryPoints?: string[];
    quizzes?: Quiz[];
    roadmaps?: Roadmap[];
    drawingHistory?: string[]; // Array of data URLs for canvas states
    drawingHistoryIndex?: number;
    whiteboardBackground?: 'plain' | 'grid' | 'lined';
    folderId?: string | null;
    uploadedFiles?: UploadedFile[];
}

export enum QuestionType {
  MultipleChoice = 'multiple-choice',
  TrueFalse = 'true-false',
  FillInTheBlank = 'fill-in-the-blank',
  CorrectTheStatement = 'correct-the-statement',
}

export interface QuizQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  statement?: string; // For 'correct-the-statement'
  answer: string;
  explanation: string;
}

export interface LearningStep {
  step: number;
  concept: string;
  description: string;
}