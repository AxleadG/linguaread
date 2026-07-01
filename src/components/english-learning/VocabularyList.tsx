"use client";

import { useMemo } from "react";
import { Volume2, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VocabItem } from "@/lib/english-learning/types";
import { useTTS } from "@/lib/english-learning/useTTS";

interface VocabularyListProps {
  vocabulary: VocabItem[];
  savedWords: Set<string>;
  onToggleSave: (item: VocabItem) => void;
}

export function VocabularyList({
  vocabulary,
  savedWords,
  onToggleSave,
}: VocabularyListProps) {
  const tts = useTTS();

  const sorted = useMemo(() => {
    // Stable sort: saved first, then alphabetical.
    return [...vocabulary].sort((a, b) => {
      const sa = savedWords.has(a.word.toLowerCase()) ? 0 : 1;
      const sb = savedWords.has(b.word.toLowerCase()) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.word.localeCompare(b.word);
    });
  }, [vocabulary, savedWords]);

  if (vocabulary.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        AI 未识别到值得学习的词汇，请尝试更长的材料。
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">重点词汇</span>
          {" · "}
          共 {vocabulary.length} 个，点击书签收藏
        </span>
        {tts.supported ? (
          <span className="flex items-center gap-1 text-xs">
            <Volume2 className="h-3.5 w-3.5" />
            可点击喇叭朗读
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => {
          const saved = savedWords.has(item.word.toLowerCase());
          const isSpeaking = tts.speakingKey === `vocab:${item.word.toLowerCase()}`;
          return (
            <div
              key={item.word}
              className={cn(
                "group flex flex-col rounded-xl border bg-card p-4 transition-shadow",
                "hover:shadow-md",
                saved ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="truncate text-lg font-semibold tracking-tight">
                      {item.word}
                    </h4>
                    {item.partOfSpeech ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100/70 text-amber-900"
                      >
                        {item.partOfSpeech}
                      </Badge>
                    ) : null}
                  </div>
                  {item.phonetic ? (
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {item.phonetic}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {tts.supported ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn("h-8 w-8", isSpeaking && "bg-amber-200/60")}
                      onClick={() =>
                        tts.speak(item.word, `vocab:${item.word.toLowerCase()}`)
                      }
                      title="朗读"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onToggleSave(item)}
                    title={saved ? "取消收藏" : "收藏"}
                  >
                    {saved ? (
                      <BookmarkCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <BookmarkPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-sm leading-6 text-foreground/90">
                {item.definition}
              </div>
              {item.example ? (
                <div className="mt-2.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs italic leading-5 text-muted-foreground">
                  “{item.example}”
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
