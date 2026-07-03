"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiConfig, PhraseTranslationResult } from "@/lib/english-learning/types";
import { safeFetchJson } from "@/lib/english-learning/safe-fetch";
import { useTTS } from "@/lib/english-learning/useTTS";

interface SelectionPopoverProps {
  text: string;
  rect: DOMRect;
  context?: string;
  apiConfig?: ApiConfig | null;
  onClose: () => void;
}

const translationCache = new Map<string, string>();

export function SelectionPopover({
  text,
  rect,
  context,
  apiConfig,
  onClose,
}: SelectionPopoverProps) {
  const cacheKey = `${text.toLowerCase()}::${context?.toLowerCase() ?? ""}`;

  const cachedOnMount = translationCache.get(cacheKey);
  const [translation, setTranslation] = useState<string | null>(
    cachedOnMount ?? null,
  );
  const [loading, setLoading] = useState(cachedOnMount === undefined);
  const [error, setError] = useState<string | null>(null);
  const tts = useTTS();

  useEffect(() => {
    if (cachedOnMount !== undefined) return;
    let cancelled = false;
    (async () => {
      const result = await safeFetchJson<PhraseTranslationResult>(
        "/api/translate-phrase",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, context, config: apiConfig }),
        },
      );
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setError(result.error || "翻译失败");
        setLoading(false);
        return;
      }
      translationCache.set(cacheKey, result.data.translation);
      setTranslation(result.data.translation);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, text, context, apiConfig, cachedOnMount]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Only close on meaningful window scrolls (>10px), ignoring micro-scrolls.
  useEffect(() => {
    const startScrollY = window.scrollY;
    const startScrollX = window.scrollX;
    const handleScroll = () => {
      const dy = Math.abs(window.scrollY - startScrollY);
      const dx = Math.abs(window.scrollX - startScrollX);
      if (dy < 10 && dx < 10) return;
      onClose();
    };
    window.addEventListener("scroll", handleScroll, false);
    return () => window.removeEventListener("scroll", handleScroll, false);
  }, [onClose]);

  const popoverWidth = 320;
  const margin = 8;
  const centerX = rect.left + rect.width / 2;
  let left = centerX - popoverWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

  const spaceBelow = window.innerHeight - rect.bottom;
  const showBelow = spaceBelow > 200 || spaceBelow > rect.top;
  const top = showBelow ? rect.bottom + margin : rect.top - margin;

  return (
    <div
      className="fixed z-50 w-80 rounded-lg border border-border bg-popover shadow-xl"
      style={{ left: `${left}px`, top: `${top}px`, maxHeight: "300px" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="absolute h-2 w-2 rotate-45 border-l border-t border-border bg-popover"
        style={{
          left: `${centerX - left - 4}px`,
          [showBelow ? "top" : "bottom"]: `-5px`,
          ...(showBelow ? {} : { transform: "rotate(225deg)" }),
        }}
      />
      <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">
            {text}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {tts.supported ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => tts.speak(text, `selection:${text}`)}
              title="朗读选中文本"
            >
              <Volume2 className="h-3 w-3" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={onClose}
            title="关闭"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2.5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            正在翻译…
          </div>
        ) : error ? (
          <div className="text-xs text-destructive">{error}</div>
        ) : (
          <p className="text-sm leading-6 text-foreground">{translation}</p>
        )}
      </div>
    </div>
  );
}
