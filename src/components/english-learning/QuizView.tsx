"use client";

import { useState } from "react";
import { Check, X, RotateCcw, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/english-learning/types";

interface QuizViewProps {
  questions: QuizQuestion[];
}

export function QuizView({ questions }: QuizViewProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);

  // Reset state when the question set changes (e.g. new analysis).
  // Note: parent should remount this component via key for a clean reset.

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
  };

  const handleReset = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        AI 未生成测验题，请尝试更长的材料。
      </div>
    );
  }

  const allAnswered = answers.every((a) => a !== null);
  const correctCount = submitted
    ? answers.filter((a, i) => a === questions[i].answer).length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">阅读理解</span>
          {" · "}
          共 {questions.length} 题，作答完毕后可查看答案与解析
        </span>
        {submitted ? (
          <Badge
            variant="secondary"
            className={cn(
              "text-sm",
              correctCount === questions.length
                ? "bg-emerald-100 text-emerald-900"
                : correctCount >= questions.length / 2
                  ? "bg-amber-100 text-amber-900"
                  : "bg-rose-100 text-rose-900",
            )}
          >
            得分 {correctCount} / {questions.length}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const userAnswer = answers[qIdx];
          const isCorrect = submitted && userAnswer === q.answer;
          return (
            <div
              key={qIdx}
              className="rounded-xl border border-border/60 bg-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {qIdx + 1}
                </span>
                <p className="text-[15px] leading-7 text-foreground">
                  {q.question}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((opt, oIdx) => {
                  const selected = userAnswer === oIdx;
                  const isAnswer = q.answer === oIdx;
                  const showState = submitted && (selected || isAnswer);
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelect(qIdx, oIdx)}
                      disabled={submitted}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !submitted && selected && "border-primary bg-primary/5",
                        !submitted && !selected && "border-border/60",
                        submitted && isAnswer && "border-emerald-500 bg-emerald-50",
                        submitted &&
                          selected &&
                          !isAnswer &&
                          "border-rose-400 bg-rose-50",
                        submitted && !selected && !isAnswer && "border-border/60 opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                          !showState && "border-current text-muted-foreground",
                          submitted && isAnswer && "border-emerald-600 bg-emerald-600 text-white",
                          submitted &&
                            selected &&
                            !isAnswer &&
                            "border-rose-500 bg-rose-500 text-white",
                        )}
                      >
                        {showState && isAnswer ? (
                          <Check className="h-3 w-3" />
                        ) : showState && selected && !isAnswer ? (
                          <X className="h-3 w-3" />
                        ) : (
                          String.fromCharCode(65 + oIdx)
                        )}
                      </span>
                      <span className="flex-1 leading-5">{opt}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation ? (
                <div
                  className={cn(
                    "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-amber-200 bg-amber-50/60",
                  )}
                >
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="leading-6 text-foreground/90">
                    <span className="font-medium">解析：</span>
                    {q.explanation}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!submitted ? (
          <Button
            type="button"
            onClick={() => setSubmitted(true)}
            disabled={!allAnswered}
            className="gap-2"
          >
            提交并查看解析
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            重新作答
          </Button>
        )}
        {!allAnswered && !submitted ? (
          <span className="text-xs text-muted-foreground">
            还有 {questions.length - answers.filter((a) => a !== null).length}{" "}
            题未作答
          </span>
        ) : null}
      </div>
    </div>
  );
}
