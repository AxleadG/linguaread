"use client";

import { useMemo } from "react";
import { Volume2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTTS } from "@/lib/english-learning/useTTS";
import type { VocabItem } from "@/lib/english-learning/types";

interface SavedVocabDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: VocabItem[];
  onRemove: (word: string) => void;
  onClear: () => void;
}

export function SavedVocabDrawer({
  open,
  onOpenChange,
  items,
  onRemove,
  onClear,
}: SavedVocabDrawerProps) {
  const tts = useTTS();

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.word.localeCompare(b.word)),
    [items],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-base">我的生词本</SheetTitle>
              <SheetDescription className="text-xs">
                本地保存，关闭浏览器后仍保留
              </SheetDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            共 {items.length} 个
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
          {items.length === 0 ? (
            <div className="mt-12 px-6 text-center">
              <div className="text-sm text-muted-foreground">
                还没有收藏的单词。
              </div>
              <div className="mt-1 text-xs text-muted-foreground/80">
                在阅读模式或词汇卡片中点击书签图标即可收藏。
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((item) => (
                <li
                  key={item.word}
                  className="rounded-lg border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold">{item.word}</span>
                        {item.partOfSpeech ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100/70 text-amber-900 text-[10px]"
                          >
                            {item.partOfSpeech}
                          </Badge>
                        ) : null}
                        {item.phonetic ? (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {item.phonetic}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm leading-5 text-foreground/90">
                        {item.definition}
                      </p>
                      {item.example ? (
                        <p className="mt-1 text-[11px] italic leading-5 text-muted-foreground">
                          “{item.example}”
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {tts.supported ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() =>
                            tts.speak(item.word, `saved:${item.word.toLowerCase()}`)
                          }
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(item.word)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-border bg-muted/30 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("确定清空所有保存的单词吗？")) onClear();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空生词本
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
