"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, Loader2, BookmarkPlus, BookmarkCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ApiConfig,
  VocabItem,
  WordLookupResult,
} from "@/lib/english-learning/types";
import { safeFetchJson } from "@/lib/english-learning/safe-fetch";

interface WordPopoverProps {
  word: string;
  preset?: VocabItem | WordLookupResult | null;
  context?: string;
  saved?: boolean;
  onToggleSave?: (item: VocabItem | WordLookupResult) => void;
  onSpeak?: (text: string, key: string) => void;
  speakingKey?: string | null;
  highlighted?: boolean;
  selected?: boolean;
  apiConfig?: ApiConfig | null;
  wordIdx?: number | null;
  children?: React.ReactNode;
}

export function WordPopover({
  word,
  preset,
  context,
  saved,
  onToggleSave,
  onSpeak,
  speakingKey,
  highlighted,
  selected,
  apiConfig,
  wordIdx,
  children,
}: WordPopoverProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<VocabItem | WordLookupResult | null>(preset ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const lookup = useCallback(async () => {
    if (preset) {
      setData(preset);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await safeFetchJson<WordLookupResult>("/api/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, context, config: apiConfig }),
      });
      if (!result.ok || !result.data) {
        throw new Error(result.error || "查词失败");
      }
      setData(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "查词失败");
      fetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [preset, word, context, apiConfig]);

  useEffect(() => {
    if (open) {
      void lookup();
    }
  }, [open, lookup]);

  useEffect(() => {
    fetchedRef.current = false;
    setData(preset ?? null);
  }, [preset]);

  const isSpeaking = speakingKey === `word:${word.toLowerCase()}`;

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const down = mouseDownPosRef.current;
    if (down) {
      const dx = Math.abs(e.clientX - down.x);
      const dy = Math.abs(e.clientY - down.y);
      if (dx > 5 || dy > 5) {
        draggedRef.current = true;
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          data-word-idx={wordIdx ?? undefined}
          className={cn(
            "inline-flex items-baseline rounded px-0.5 align-baseline transition-colors",
            "hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            selected
              ? "bg-primary/20 text-primary ring-1 ring-primary/40"
              : highlighted
                ? "border-b-2 border-amber-500/70 font-medium text-foreground decoration-amber-600/40"
                : "border-b border-dashed border-ring/30 text-foreground",
            isSpeaking && "bg-amber-200/60",
          )}
          title={`Look up "${word}"`}
        >
          {children ?? word}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 text-sm shadow-lg" align="start" sideOffset={6}>
        <div className="border-b border-border bg-muted/40 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-semibold tracking-tight">{word}</span>
              {data?.phonetic ? (
                <span className="font-mono text-xs text-muted-foreground">{data.phonetic}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onSpeak?.(word, `word:${word.toLowerCase()}`)}
                disabled={!onSpeak}
                title="Pronounce"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => data && onToggleSave?.(data)}
                disabled={!data || !onToggleSave}
                title={saved ? "Remove from vocabulary" : "Save to vocabulary"}
              >
                {saved ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          {data?.partOfSpeech ? (
            <div className="mt-0.5 text-xs italic text-muted-foreground">{data.partOfSpeech}</div>
          ) : null}
        </div>
        <div className="px-3 py-2.5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Looking up…
            </div>
          ) : error ? (
            <div className="text-xs text-destructive">{error}</div>
          ) : data ? (
            <div className="space-y-1.5">
              <div className="text-sm leading-snug">{data.definition}</div>
              {data.example ? (
                <div className="rounded bg-muted/50 px-2 py-1.5 text-xs italic text-muted-foreground">
                  &ldquo;{data.example}&rdquo;
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No data</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
