"use client";

import { useState } from "react";
import { HelpCircle, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuizView } from "./QuizView";
import { ClozeQuizView } from "./ClozeQuizView";
import type { QuizQuestion, VocabItem } from "@/lib/english-learning/types";

interface QuizContainerProps {
  questions: QuizQuestion[];
  articleVocab: VocabItem[];
  savedVocab: VocabItem[];
  articleKey: string;
}

type QuizMode = "comprehension" | "cloze";

export function QuizContainer({
  questions,
  articleVocab,
  savedVocab,
  articleKey,
}: QuizContainerProps) {
  const [mode, setMode] = useState<QuizMode>("comprehension");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
        <span className="mr-1 text-xs text-muted-foreground">测验模式：</span>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "comprehension"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          onClick={() => setMode("comprehension")}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          阅读理解
          <span className="opacity-70">({questions.length})</span>
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "cloze"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          onClick={() => setMode("cloze")}
        >
          <PencilLine className="h-3.5 w-3.5" />
          挖词填空
        </button>
      </div>

      {mode === "comprehension" ? (
        <QuizView key={`${articleKey}-comp`} questions={questions} />
      ) : (
        <ClozeQuizView
          key={`${articleKey}-cloze`}
          articleVocab={articleVocab}
          savedVocab={savedVocab}
        />
      )}
    </div>
  );
}
