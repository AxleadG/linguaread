import { NextRequest, NextResponse } from "next/server";
import { jsonrepair } from "jsonrepair";
import type { ApiConfig, WordLookupResult } from "@/lib/english-learning/types";
import { chat, LlmError } from "@/lib/english-learning/llm-client";

export const runtime = "nodejs";
export const maxDuration = 30;

interface RawWord {
  word?: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  example?: string;
}

const SYSTEM_PROMPT = `You are an English-to-Chinese dictionary. Given an English word and optionally the sentence it appeared in, return ONLY a JSON object (no markdown fences) matching this TypeScript type:

{
  "word": string,            // the word in lowercase base form
  "phonetic": string,        // IPA, e.g. "/həˈloʊ/"
  "partOfSpeech": string,    // e.g. "n.", "v.", "adj."
  "definition": string,      // Chinese definition, 1-2 senses max
  "example": string          // a short English example sentence (use the user's sentence if provided and natural)
}

Output ONLY the JSON object. No surrounding text, no markdown fences. Double-escape any double quote inside a string value as \\". Do not include literal newlines inside strings — use \\n instead.`;

export async function POST(req: NextRequest) {
  let body: {
    word?: string;
    context?: string;
    config?: ApiConfig;
  };
  try {
    body = (await req.json()) as {
      word?: string;
      context?: string;
      config?: ApiConfig;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const word = (body.word ?? "").trim().toLowerCase();
  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }
  if (word.length > 60) {
    return NextResponse.json(
      { error: "word is too long" },
      { status: 400 },
    );
  }

  const context = (body.context ?? "").trim().slice(0, 500);
  const userPrompt = context
    ? `Word: "${word}"\nSentence where it appeared: "${context}"`
    : `Word: "${word}"`;

  try {
    const { content } = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      body.config,
      { temperature: 0.3 },
    );

    if (!content) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 },
      );
    }

    let raw: RawWord;
    let sanitized = content.trim();
    if (sanitized.startsWith("```")) {
      sanitized = sanitized
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```$/i, "")
        .trim();
    }
    try {
      raw = JSON.parse(sanitized) as RawWord;
    } catch {
      const start = sanitized.indexOf("{");
      const end = sanitized.lastIndexOf("}");
      if (start < 0 || end <= start) {
        return NextResponse.json(
          { error: "Failed to parse response" },
          { status: 502 },
        );
      }
      const slice = sanitized.slice(start, end + 1);
      try {
        raw = JSON.parse(slice) as RawWord;
      } catch {
        try {
          raw = JSON.parse(jsonrepair(slice)) as RawWord;
        } catch {
          return NextResponse.json(
            { error: "Failed to parse response" },
            { status: 502 },
          );
        }
      }
    }

    const result: WordLookupResult = {
      word: (raw.word ?? word).toLowerCase().trim(),
      phonetic: (raw.phonetic ?? "").trim(),
      partOfSpeech: (raw.partOfSpeech ?? "").trim(),
      definition: (raw.definition ?? "").trim(),
      example: (raw.example ?? "").trim(),
    };

    if (!result.definition) {
      return NextResponse.json(
        { error: "No definition found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError) {
      console.error("[/api/word] LlmError:", err.message, {
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
    console.error("[/api/word] error:", message);
    return NextResponse.json(
      { error: `Word lookup failed: ${message}` },
      { status: 500 },
    );
  }
}
