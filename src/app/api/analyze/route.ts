import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { AnalysisResult, ApiConfig } from "@/lib/english-learning/types";
import { chat, LlmError } from "@/lib/english-learning/llm-client";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RawAnalysis {
  translation?: string;
  vocabulary?: Array<{
    word?: string;
    phonetic?: string;
    partOfSpeech?: string;
    definition?: string;
    example?: string;
  }>;
  summary?: string;
  keyPoints?: string[];
  questions?: Array<{
    question?: string;
    options?: string[];
    answer?: number;
    explanation?: string;
  }>;
  grammarPoints?: Array<{
    pattern?: string;
    explanation?: string;
    example?: string;
  }>;
  difficulty?: string;
  topic?: string;
}

const SYSTEM_PROMPT = `You are an expert English language teacher helping a Chinese-speaking learner.
You will be given an English passage. Analyze it thoroughly and respond ONLY with a valid JSON object (no markdown fences, no extra commentary) matching this TypeScript type:

{
  "translation": string,              // Full Chinese translation. Preserve paragraph structure. Use \\n\\n between paragraphs.
  "vocabulary": [                     // 8-15 key/difficult words worth learning
    {
      "word": string,                 // the word in its base form (lowercase)
      "phonetic": string,             // IPA transcription, e.g. "/ˌændɪˈmæʃən/"
      "partOfSpeech": string,         // e.g. "n.", "v.", "adj.", "adv."
      "definition": string,           // Chinese definition (concise, 1-2 senses)
      "example": string               // the sentence from the source text where this word appears (verbatim)
    }
  ],
  "summary": string,                  // Chinese summary of the passage, 2-4 sentences
  "keyPoints": string[],              // 3-5 key takeaways in Chinese
  "questions": [                      // 3-4 multiple choice comprehension questions
    {
      "question": string,             // in English
      "options": string[],            // 4 options in English
      "answer": number,               // 0-based index of the correct option
      "explanation": string           // Chinese explanation of why this is correct
    }
  ],
  "grammarPoints": [                  // 2-4 notable grammar patterns from the text
    {
      "pattern": string,              // the pattern name in English, e.g. "Present Perfect"
      "explanation": string,          // Chinese explanation
      "example": string               // verbatim sentence from the source text showing this pattern
    }
  ],
  "difficulty": string,               // CEFR level: one of "A1","A2","B1","B2","C1","C2"
  "topic": string                     // detected topic in Chinese, e.g. "气候变化"
}

Rules:
- Choose vocabulary words that are genuinely useful for a Chinese learner: prefer less-common words, idioms, or words with non-obvious meanings. Skip trivial words like "the", "is", "and".
- The "example" field for each vocabulary item MUST be a real sentence copied verbatim from the source text (shorten only if the sentence is extremely long).
- "answer" must be a valid 0-based index within the options array.
- CRITICAL: produce STRICTLY valid JSON. Double-escape any double quote inside a string value as \\". Do not include literal newlines inside string values — use \\n instead. Do not include trailing commas.
- Do NOT wrap the JSON in markdown fences. Output ONLY the JSON object, nothing else.`;

function sanitizeJsonString(raw: string): string {
  let s = raw.trim();
  // Strip markdown fences if present
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  // If there is trailing text after the final closing brace, cut it.
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < s.length - 1) {
    s = s.slice(0, lastBrace + 1);
  }
  return s;
}

function safeParse(raw: string): RawAnalysis {
  const sanitized = sanitizeJsonString(raw);
  // First attempt: strict parse.
  try {
    return JSON.parse(sanitized) as RawAnalysis;
  } catch {
    // fall through
  }
  // Second attempt: extract the outermost JSON object.
  const start = sanitized.indexOf("{");
  const end = sanitized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = sanitized.slice(start, end + 1);
    try {
      return JSON.parse(slice) as RawAnalysis;
    } catch {
      // fall through to repair
    }
    // Third attempt: repair common LLM JSON issues (unescaped quotes,
    // trailing commas, etc.) using jsonrepair.
    try {
      const repaired = jsonrepair(slice);
      return JSON.parse(repaired) as RawAnalysis;
    } catch {
      // give up
    }
  }
  // Last resort: try repairing the whole thing.
  try {
    const repaired = jsonrepair(sanitized);
    return JSON.parse(repaired) as RawAnalysis;
  } catch (err) {
    throw new Error(
      `Failed to parse analysis JSON: ${
        err instanceof Error ? err.message : "unknown"
      }`,
    );
  }
}

function normalize(raw: RawAnalysis): AnalysisResult {
  const vocabulary = (raw.vocabulary ?? [])
    .filter((v) => v && typeof v.word === "string")
    .map((v) => ({
      word: (v.word ?? "").trim(),
      phonetic: (v.phonetic ?? "").trim(),
      partOfSpeech: (v.partOfSpeech ?? "").trim(),
      definition: (v.definition ?? "").trim(),
      example: (v.example ?? "").trim(),
    }))
    .filter((v) => v.word.length > 0);

  const questions = (raw.questions ?? [])
    .filter(
      (q) =>
        q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.answer === "number" &&
        q.answer >= 0 &&
        q.answer < 4,
    )
    .map((q) => ({
      question: (q.question ?? "").trim(),
      options: (q.options ?? []).map((o) => String(o).trim()),
      answer: q.answer as number,
      explanation: (q.explanation ?? "").trim(),
    }));

  const grammarPoints = (raw.grammarPoints ?? [])
    .filter((g) => g && typeof g.pattern === "string")
    .map((g) => ({
      pattern: (g.pattern ?? "").trim(),
      explanation: (g.explanation ?? "").trim(),
      example: (g.example ?? "").trim(),
    }));

  const cefr = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const difficulty = cefr.includes((raw.difficulty ?? "").toUpperCase())
    ? (raw.difficulty as string).toUpperCase()
    : "B1";

  return {
    translation: (raw.translation ?? "").trim(),
    vocabulary,
    summary: (raw.summary ?? "").trim(),
    keyPoints: Array.isArray(raw.keyPoints)
      ? raw.keyPoints.map((k) => String(k).trim()).filter(Boolean)
      : [],
    questions,
    grammarPoints,
    difficulty,
    topic: (raw.topic ?? "").trim() || "未识别",
  };
}

export async function POST(req: NextRequest) {
  let body: { text?: string; config?: ApiConfig };
  try {
    body = (await req.json()) as { text?: string; config?: ApiConfig };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length < 20) {
    return NextResponse.json(
      { error: "Please provide at least 20 characters of English text." },
      { status: 400 },
    );
  }
  if (text.length > 8000) {
    return NextResponse.json(
      { error: "Text is too long (max 8000 characters)." },
      { status: 400 },
    );
  }

  const config = body.config;
  const usingCustom = Boolean(config?.enabled);

  try {
    const { content } = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      config,
      { temperature: 0.4 },
    );

    if (!content) {
      return NextResponse.json(
        { error: "AI returned an empty response. Please try again." },
        { status: 502 },
      );
    }

    const raw = safeParse(content);
    const result = normalize(raw);

    if (
      !result.translation &&
      result.vocabulary.length === 0 &&
      result.questions.length === 0
    ) {
      return NextResponse.json(
        {
          error: usingCustom
            ? "AI 返回了无法解析的内容。请检查自定义 API 配置（模型是否支持中文 / JSON 输出），或重试一次。"
            : "AI response was unparseable. Please try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError) {
      console.error("[/api/analyze] LlmError:", err.message, {
        status: err.status,
        upstream: err.upstream,
      });
      return NextResponse.json(
        { error: err.message },
        { status: typeof err.status === "number" ? err.status : 500 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    console.error("[/api/analyze] error:", message);
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 },
    );
  }
}
