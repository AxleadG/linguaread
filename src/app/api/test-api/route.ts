import { NextRequest, NextResponse } from "next/server";
import type { ApiConfig } from "@/lib/english-learning/types";
import { chat, LlmError } from "@/lib/english-learning/llm-client";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Tests a user-provided custom API config by sending a tiny "hello" prompt.
 * Returns { ok: true, reply } on success, { ok: false, error } on failure.
 *
 * The config is sent in the request body (never stored server-side).
 */
export async function POST(req: NextRequest) {
  let body: { config?: ApiConfig };
  try {
    body = (await req.json()) as { config?: ApiConfig };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const config = body.config;
  if (!config?.enabled) {
    return NextResponse.json(
      { ok: false, error: "自定义 API 未启用" },
      { status: 400 },
    );
  }

  try {
    const { content } = await chat(
      [
        {
          role: "system",
          content:
            "You are a connectivity test. Reply with the single word: pong",
        },
        { role: "user", content: "ping" },
      ],
      config,
      { temperature: 0, maxTokens: 16 },
    );
    return NextResponse.json({
      ok: true,
      reply: content.trim().slice(0, 100),
    });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: typeof err.status === "number" ? err.status : 500 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
