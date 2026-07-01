"use client";

import { BookOpen, Sparkles, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GrammarPoint } from "@/lib/english-learning/types";

interface SummaryViewProps {
  summary: string;
  keyPoints: string[];
  grammarPoints: GrammarPoint[];
  difficulty: string;
  topic: string;
}

export function SummaryView({
  summary,
  keyPoints,
  grammarPoints,
  difficulty,
  topic,
}: SummaryViewProps) {
  return (
    <div className="space-y-5">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm">
        <span className="text-muted-foreground">文本概况</span>
        <Badge variant="secondary" className="bg-emerald-100/70 text-emerald-900">
          难度 {difficulty}
        </Badge>
        {topic && topic !== "未识别" ? (
          <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
            主题：{topic}
          </Badge>
        ) : null}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          AI 摘要
        </div>
        {summary ? (
          <p className="text-[15px] leading-8 text-foreground/90">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">暂无摘要</p>
        )}
      </div>

      {/* Key points */}
      {keyPoints.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <ListChecks className="h-4 w-4" />
            要点提炼
          </div>
          <ul className="space-y-2">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] leading-7">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="text-foreground/90">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Grammar points */}
      {grammarPoints.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <BookOpen className="h-4 w-4" />
            语法点解析
          </div>
          <div className="space-y-3">
            {grammarPoints.map((g, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {g.pattern}
                  </Badge>
                </div>
                <p className="text-[15px] leading-7 text-foreground/90">
                  {g.explanation}
                </p>
                {g.example ? (
                  <p className="mt-2 rounded bg-background/80 px-2.5 py-1.5 text-sm italic leading-6 text-muted-foreground">
                    “{g.example}”
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
