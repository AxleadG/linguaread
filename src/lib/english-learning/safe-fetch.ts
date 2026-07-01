"use client";

/**
 * Wraps fetch + JSON parsing so that non-JSON responses (HTML error pages
 * from gateways/proxies, dev-server compilation pages, etc.) surface as
 * readable errors instead of crashing with "Unexpected token '<'".
 */
export interface SafeJsonResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T>(
  input: string,
  init?: RequestInit,
): Promise<SafeJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error:
        e instanceof Error
          ? e.name === "TimeoutError" || e.name === "AbortError"
            ? "请求超时，请检查网络后重试"
            : `网络请求失败：${e.message}`
          : "网络请求失败",
    };
  }

  const contentType = res.headers.get("content-type") || "";

  // Read body once; we'll try JSON parse on it.
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    return {
      ok: false,
      status: res.status,
      error: `无法读取响应（HTTP ${res.status}）`,
    };
  }

  // If the server says it's not JSON, or the body clearly starts with HTML,
  // surface a friendly error.
  const looksLikeHtml =
    !contentType.includes("application/json") &&
    /^\s*<(?:!doctype|html|head|body|h1|p|pre)\b/i.test(bodyText);

  if (looksLikeHtml) {
    // Try to extract a title or h1 for context.
    const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const h1Match = bodyText.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const label =
      (titleMatch?.[1]?.trim()) || (h1Match?.[1]?.trim()) || "HTML 错误页";
    const reason =
      res.status === 502 || res.status === 504
        ? "网关超时或上游不可用"
        : res.status === 500
          ? "服务器内部错误"
          : res.status === 404
            ? "接口不存在"
            : res.status === 0
              ? "网络中断"
              : "响应不是 JSON";
    return {
      ok: false,
      status: res.status,
      error: `${reason}（HTTP ${res.status}，${label}）。可能是 AI 上游限流或网关超时，请稍后重试，或在右上角"设置"中切换自定义 API。`,
    };
  }

  let data: T;
  try {
    data = JSON.parse(bodyText) as T;
  } catch (e) {
    const snippet = bodyText.slice(0, 120).replace(/\s+/g, " ").trim();
    return {
      ok: false,
      status: res.status,
      error: `响应无法解析为 JSON${
        snippet ? `：${snippet}` : ""
      }${e instanceof Error ? `（${e.message}）` : ""}`,
    };
  }

  if (!res.ok) {
    const errObj = data as { error?: string };
    return {
      ok: false,
      status: res.status,
      error: errObj.error || `请求失败（HTTP ${res.status}）`,
    };
  }

  return { ok: true, status: res.status, data };
}
