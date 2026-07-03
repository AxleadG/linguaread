"use client";

import { useMemo } from "react";
import { History, Trash2, X, Clock, BookMarked } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ArticleHistoryEntry } from "@/lib/english-learning/types";

interface ArticleHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ArticleHistoryEntry[];
  currentText: string;
  onLoad: (entry: ArticleHistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function ArticleHistoryDrawer({
  open,
  onOpenChange,
  entries,
  currentText,
  onLoad,
  onRemove,
  onClear,
}: ArticleHistoryDrawerProps) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.timestamp - a.timestamp),
    [entries],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" />
                学习历史
              </SheetTitle>
              <SheetDescription className="text-xs">
                本地保存最近 {entries.length} 篇文章，点击可重新打开
              </SheetDescription>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
          {sorted.length === 0 ? (
            <div className="mt-12 px-6 text-center">
              <BookMarked className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <div className="mt-3 text-sm text-muted-foreground">还没有学习记录</div>
              <div className="mt-1 text-xs text-muted-foreground/80">分析过的文章会自动保存到这里</div>
            </div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((entry) => {
                const isActive = entry.text === currentText;
                return (
                  <li key={entry.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`group flex cursor-pointer items-start justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                        isActive
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/60 bg-card hover:bg-muted/40"
                      }`}
                      onClick={() => onLoad(entry)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onLoad(entry);
                        }
                      }}
                    >
                      <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-5 text-foreground">
                        {entry.title}
                      </p>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(entry.id);
                        }}
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 -mt-1">
                      <Badge variant="secondary" className="bg-emerald-100/60 px-1.5 text-[10px] text-emerald-900">
                        {entry.result.difficulty}
                      </Badge>
                      {entry.result.topic && entry.result.topic !== "未识别" ? (
                        <Badge variant="secondary" className="bg-amber-100/60 px-1.5 text-[10px] text-amber-900">
                          {entry.result.topic}
                        </Badge>
                      ) : null}
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTime(entry.timestamp)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · {entry.result.vocabulary.length} 生词
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {sorted.length > 0 ? (
          <div className="border-t border-border bg-muted/30 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("确定清空所有学习记录吗？")) onClear();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空历史
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
