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

/** A saved article with its full analysis result. */
export interface ArticleHistoryEntry {
  id: string;
  title: string; // first ~60 chars of the English text
  text: string; // the analyzed English text
  result: AnalysisResult;
  timestamp: number;
}

/** Result from the phrase-translation endpoint. */
export interface PhraseTranslationResult {
  translation: string;
}

/**
 * User-provided custom LLM API configuration.
 * Stored in browser localStorage; sent to the Next.js API route in the
 * request body so the backend can relay it to the actual LLM provider.
 *
 * The API key never leaves the user's browser except to our own API route,
 * which only uses it for the single relayed request and does not persist it.
 */
export interface ApiConfig {
  /** Whether to use the custom API instead of the built-in z-ai SDK. */
  enabled: boolean;
  /** OpenAI-compatible base URL, e.g. "https://api.openai.com/v1" or "https://open.bigmodel.cn/api/paas/v4". */
  baseUrl: string;
  /** API key (Bearer token). */
  apiKey: string;
  /** Model name, e.g. "gpt-4o-mini", "glm-4-flash", "deepseek-chat". */
  model: string;
}

export const DEFAULT_API_CONFIG: ApiConfig = {
  enabled: false,
  baseUrl: "",
  apiKey: "",
  model: "",
};

/** Common OpenAI-compatible endpoints for the preset picker. */
export interface ApiPreset {
  label: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  hint: string;
}

export const API_PRESETS: ApiPreset[] = [
  {
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    models: ["glm-4-flash", "glm-4-air", "glm-4-plus", "glm-4"],
    hint: "https://open.bigmodel.cn/userinfo/apikey",
  },
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    hint: "https://platform.openai.com/api-keys",
  },
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    hint: "https://platform.deepseek.com/api_keys",
  },
  {
    label: "月之暗面 Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    hint: "https://platform.moonshot.cn/console/api-keys",
  },
  {
    label: "阿里通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
    models: ["qwen-turbo", "qwen-plus", "qwen-max"],
    hint: "https://dashscope.console.aliyun.com/apiKey",
  },
  {
    label: "Anthropic Claude (兼容网关)",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-haiku-latest",
    models: [
      "claude-3-5-haiku-latest",
      "claude-3-5-sonnet-latest",
      "claude-3-7-sonnet-latest",
    ],
    hint: "https://console.anthropic.com/settings/keys",
  },
];
