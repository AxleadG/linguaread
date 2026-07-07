import { NextRequest, NextResponse } from "next/server";
import type { ApiConfig } from "@/lib/english-learning/types";
import { chat, LlmError } from "@/lib/english-learning/llm-client";

export const runtime = "nodejs";
export const maxDuration = 20;

const SYSTEM_PROMPT = `You are an English-English dictionary. Given an English word, return ONLY a concise English definition (1-2 sentences, max 20 words). No example sentences, no synonyms, no etymology. Just the definition. Output raw text, no JSON, no quotes, no markdown.`;

export async function POST(req: NextRequest) {
  let body: { word?: string; config?: ApiConfig };
  try {
    body = (await req.json()) as { word?: string; config?: ApiConfig };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const word = (body.word ?? "").trim().toLowerCase();
  if (!word) {
    return NextResponse.json({ error: "word is required" }, { status: 400 });
  }

  try {
    const { content } = await chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Define: "${word}"` },
      ],
      body.config,
      { temperature: 0.3, maxTokens: 60 },
    );

    const definition = content.trim();
    if (!definition) {
      return NextResponse.json(
        { error: "AI returned empty definition" },
        { status: 502 },
      );
    }

    return NextResponse.json({ word, definition });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message },
        { status: typeof err.status === "number" ? err.status : 500 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      { error: `Failed: ${message}` },
      { status: 500 },
    );
  }
}
