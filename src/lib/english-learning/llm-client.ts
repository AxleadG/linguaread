import ZAI from "z-ai-web-dev-sdk";
import type { ApiConfig } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
}

export class LlmError extends Error {
  readonly status?: number;
  readonly upstream?: string;
  constructor(message: string, opts?: { status?: number; upstream?: string }) {
    super(message);
    this.name = "LlmError";
    if (typeof opts?.status === "number") this.status = opts.status;
    if (opts?.upstream) this.upstream = opts.upstream;
  }
}

function isNonEmpty(s: string | undefined | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Validates that the user-provided config is complete and safe enough
 * to relay to an upstream API. Returns a normalized config or throws.
 */
function validateCustomConfig(config: ApiConfig): {
  baseUrl: string;
  apiKey: string;
  model: string;
} {
  if (!isNonEmpty(config.baseUrl)) {
    throw new LlmError("自定义 API 未填写 Base URL", { status: 400 });
  }
  if (!isNonEmpty(config.apiKey)) {
    throw new LlmError("自定义 API 未填写 API Key", { status: 400 });
  }
  if (!isNonEmpty(config.model)) {
    throw new LlmError("自定义 API 未填写模型名称", { status: 400 });
  }
  let baseUrl = config.baseUrl.trim();
  // Strip trailing slashes so we can append "/chat/completions" cleanly.
  baseUrl = baseUrl.replace(/\/+$/, "");
  // Reject obviously non-http(s) schemes to prevent SSRF via file:// etc.
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new LlmError("Base URL 必须以 http:// 或 https:// 开头", {
      status: 400,
    });
  }
  return { baseUrl, apiKey: config.apiKey.trim(), model: config.model.trim() };
}

/**
 * Calls an OpenAI-compatible /chat/completions endpoint.
 *
 * Most major providers (智谱 GLM, DeepSeek, Kimi, 通义千问, OpenAI itself)
 * expose this format. Anthropic's native API differs slightly, so users who
 * want Claude should point at a compatible gateway.
 */
async function callOpenAiCompatible(
  config: ApiConfig,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const { baseUrl, apiKey, model } = validateCustomConfig(config);
  const url = `${baseUrl}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    stream: false,
  };
  if (typeof opts.maxTokens === "number") {
    body.max_tokens = opts.maxTokens;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      // 90s hard cap — analysis prompts can take a while.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "TimeoutError" || e.name === "AbortError"
          ? "请求自定义 API 超时（>90s）"
          : `无法连接到自定义 API：${e.message}`
        : "无法连接到自定义 API";
    throw new LlmError(msg, { status: 502, upstream: "network" });
  }

  // Many gateways return HTML on 5xx / rate limit. Detect early and surface
  // a friendly error instead of letting JSON.parse blow up downstream.
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new LlmError(
      `自定义 API 返回了非 JSON 响应（HTTP ${res.status}，${contentType || "未知类型"}）${
        snippet ? `：${snippet}` : ""
      }`,
      { status: 502, upstream: "non-json" },
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof errJson?.error === "string") detail = errJson.error;
      else if (typeof errJson?.error?.message === "string")
        detail = errJson.error.message;
      else if (typeof errJson?.message === "string") detail = errJson.message;
    } catch {
      // ignore
    }
    const reason =
      res.status === 401 || res.status === 403
        ? "API Key 无效或权限不足"
        : res.status === 429
          ? "调用过于频繁（限流）"
          : res.status >= 500
            ? "上游服务暂时不可用"
            : "请求被拒绝";
    throw new LlmError(
      `自定义 API 错误（HTTP ${res.status} · ${reason}）${detail ? `：${detail}` : ""}`,
      { status: res.status, upstream: "http" },
    );
  }

  let json: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    json = (await res.json()) as typeof json;
  } catch (e) {
    throw new LlmError(
      `自定义 API 响应无法解析为 JSON：${
        e instanceof Error ? e.message : "未知错误"
      }`,
      { status: 502, upstream: "parse" },
    );
  }

  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new LlmError("自定义 API 返回了空回复", { status: 502 });
  }
  return { content };
}

async function callZaiSdk(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch (e) {
    throw new LlmError(
      `内置 AI 配置加载失败：${e instanceof Error ? e.message : "未知错误"}`,
      { status: 500,
        upstream: "z-ai-config" },
    );
  }

  try {
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
      temperature: opts.temperature ?? 0.4,
    });
    const content = completion.choices[0]?.message?.content ?? "";
    if (!content) {
      throw new LlmError("内置 AI 返回了空回复", { status: 502 });
    }
    return { content };
  } catch (e) {
    if (e instanceof LlmError) throw e;
    const msg = e instanceof Error ? e.message : "未知错误";
    // Surface a friendlier message for the most common failures.
    if (/rate.?limit|429/i.test(msg)) {
      throw new LlmError("内置 AI 调用过于频繁，请稍后再试", {
        status: 429,
        upstream: "z-ai",
      });
    }
    if (/timeout|aborted/i.test(msg)) {
      throw new LlmError("内置 AI 请求超时，请稍后再试", {
        status: 504,
        upstream: "z-ai",
      });
    }
    throw new LlmError(`内置 AI 调用失败：${msg}`, {
      status: 502,
      upstream: "z-ai",
    });
  }
}

/**
 * Calls the server-side default LLM provider (DeepSeek) using credentials
 * stored in environment variables. The API key never leaves the server.
 *
 * Used when the user has NOT configured their own custom API — this gives
 * a good out-of-box experience (DeepSeek is fast and cheap) without
 * exposing any keys to the frontend.
 */
async function callServerDefault(
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  if (!apiKey) {
    // No server-side key configured — fall back to z-ai SDK.
    return callZaiSdk(messages, opts);
  }

  const url = `${baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    stream: false,
  };
  if (typeof opts.maxTokens === "number") {
    body.max_tokens = opts.maxTokens;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "TimeoutError" || e.name === "AbortError"
          ? "请求超时（>90s）"
          : `无法连接到 AI 服务：${e.message}`
        : "无法连接到 AI 服务";
    throw new LlmError(msg, { status: 502, upstream: "network" });
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new LlmError(
      `AI 服务返回了非 JSON 响应（HTTP ${res.status}）${snippet ? `：${snippet}` : ""}`,
      { status: 502, upstream: "non-json" },
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof errJson?.error === "string") detail = errJson.error;
      else if (typeof errJson?.error?.message === "string")
        detail = errJson.error.message;
      else if (typeof errJson?.message === "string") detail = errJson.message;
    } catch {
      // ignore
    }
    const reason =
      res.status === 401 || res.status === 403
        ? "API Key 无效或权限不足"
        : res.status === 429
          ? "调用过于频繁（限流）"
          : res.status >= 500
            ? "上游服务暂时不可用"
            : "请求被拒绝";
    throw new LlmError(
      `AI 服务错误（HTTP ${res.status} · ${reason}）${detail ? `：${detail}` : ""}`,
      { status: res.status, upstream: "http" },
    );
  }

  let json: {
    choices?: Array<{ message?: { content?: string } }>;
  };
  try {
    json = (await res.json()) as typeof json;
  } catch (e) {
    throw new LlmError(
      `AI 服务响应无法解析为 JSON：${
        e instanceof Error ? e.message : "未知错误"
      }`,
      { status: 502, upstream: "parse" },
    );
  }

  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new LlmError("AI 服务返回了空回复", { status: 502 });
  }
  return { content };
}

/**
 * Unified entry point. Priority:
 * 1. User-provided custom API (if `config.enabled` and complete)
 * 2. Server-side default (DeepSeek via env vars) — no user config needed
 * 3. Built-in z-ai SDK (last resort fallback)
 *
 * This is server-only: it relays API keys to upstream providers.
 */
export async function chat(
  messages: ChatMessage[],
  config: ApiConfig | null | undefined,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  if (config?.enabled) {
    return callOpenAiCompatible(config, messages, opts);
  }
  return callServerDefault(messages, opts);
}
