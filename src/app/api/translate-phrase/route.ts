import { NextRequest, NextResponse } from "next/server";
import type { ApiConfig, PhraseTranslationResult } from "@/lib/english-learning/types";
import { chat, LlmError } from "@/lib/english-learning/llm-client";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a professional English-to-Chinese translator. The user will give you a short English word, phrase, or sentence (possibly extracted from a larger passage). Translate it to Chinese concisely and naturally.

Rules:
- If it's a single word, give its most common Chinese meaning (1-3 words).
- If it's a phrase (2-8 words), translate the phrase as a natural unit.
- If it's a full sentence, translate the whole sentence.
- Output ONLY the Chinese translation. No pinyin, no explanation, no quotes, no markdown, no JSON. Just the raw Chinese text.`;

export async function POST(req: NextRequest) {
  let body: { text?: string; context?: string; config?: ApiConfig };
  try {
    body = (await req.json()) as {
      text?: string;
      context?: string;
      config?: ApiConfig;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json(
      { error: "Selection too long (max 500 chars)" },
      { status: 400 },
    );
  }

  const userPrompt = body.context?.trim()
    ? `Translate to Chinese:\n"${text}"\n\nContext (the full sentence it appeared in): "${body.context.trim().slice(0, 500)}"`
    : `Translate to Chinese:\n"${text}"`;

  try {
    const { content } = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      body.config,
      { temperature: 0.3 },
    );

    const translation = content.trim();
    if (!translation) {
      return NextResponse.json(
        { error: "AI returned empty translation" },
        { status: 502 },
      );
    }

    const result: PhraseTranslationResult = { translation };
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError) {
      console.error("[/api/translate-phrase] LlmError:", err.message, {
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
    console.error("[/api/translate-phrase] error:", message);
    return NextResponse.json(
      { error: `Translation failed: ${message}` },
      { status: 500 },
    );
  }
}
