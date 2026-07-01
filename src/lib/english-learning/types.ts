// Shared types for the English learning app

export interface VocabItem {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string; // Chinese definition
  example: string; // Original sentence from the source text
}

export interface GrammarPoint {
  pattern: string;
  explanation: string;
  example: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number; // index of correct option
  explanation: string;
}

export interface AnalysisResult {
  translation: string; // Full Chinese translation (paragraph-by-paragraph)
  vocabulary: VocabItem[];
  summary: string; // Chinese summary
  keyPoints: string[]; // Key takeaways in Chinese
  questions: QuizQuestion[];
  grammarPoints: GrammarPoint[];
  difficulty: string; // CEFR level estimate, e.g. "B1"
  topic: string; // detected topic in Chinese
}

export interface WordLookupResult {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  example: string;
}
