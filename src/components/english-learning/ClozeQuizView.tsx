"use client";

import { useMemo, useState } from "react";
import { Check, X, RotateCcw, Lightbulb, Shuffle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { VocabItem } from "@/lib/english-learning/types";

interface ClozeQuizViewProps {
  articleVocab: VocabItem[];
  savedVocab: VocabItem[];
}

interface ClozeQuestion {
  word: VocabItem;
  sentenceBefore: string;
  sentenceAfter: string;
  fullSentence: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?;:"'`()]/g, "");
}

function buildClozeQuestions(pool: VocabItem[], count: number): ClozeQuestion[] {
  const eligible = pool.filter((v) => {
    if (!v.example || !v.word) return false;
    return v.example.toLowerCase().includes(v.word.toLowerCase());
  });
  if (eligible.length === 0) return [];
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));
  return selected.map((word) => {
    const idx = word.example.toLowerCase().indexOf(word.word.toLowerCase());
    return {
      word,
      sentenceBefore: word.example.slice(0, idx),
      sentenceAfter: word.example.slice(idx + word.word.length),
      fullSentence: word.example,
    };
  });
}

export function ClozeQuizView({ articleVocab, savedVocab }: ClozeQuizViewProps) {
  const [source, setSource] = useState<"article" | "saved">(() =>
    savedVocab.length >= 4 ? "saved" : "article",
  );
  const [seed, setSeed] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const pool = source === "saved" ? savedVocab : articleVocab;

  const questions = useMemo(() => {
    return buildClozeQuestions(pool, 8);
  }, [source, seed, pool]);

  const [lastQuestionKey, setLastQuestionKey] = useState("");
  const currentKey = questions.map((q) => q.word.word).join(",");
  if (currentKey !== lastQuestionKey) {
    setLastQuestionKey(currentKey);
    setAnswers(questions.map(() => ""));
    setSubmitted(false);
    setRevealed(new Set());
  }

  const handleAnswerChange = (idx: number, value: string) => {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleReveal = (idx: number) => {
    setRevealed((prev) => new Set([...prev, idx]));
  };

  const handleReset = () => {
    setAnswers(questions.map(() => ""));
    setSubmitted(false);
    setRevealed(new Set());
  };

  const handleRegenerate = () => setSeed((s) => s + 1);

  const handleSourceChange = (newSource: "article" | "saved") => {
    setSource(newSource);
    setSeed((s) => s + 1);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {source === "saved"
          ? "生词本中没有带例句的单词。请在精读模式下收藏一些单词后再来练习。"
          : "本课生词中没有可用于填空练习的单词（需要单词带有原文例句）。"}
        {source === "article" && savedVocab.length > 0 ? (
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => handleSourceChange("saved")}>
              切换到生词本练习
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const allAnswered = answers.every((a) => a.trim().length > 0);
  const correctCount = submitted
    ? answers.filter((a, i) => normalize(a) === normalize(questions[i].word.word)).length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">挖词填空</span>
          {" · "}
          根据上下文填入正确的单词（不区分大小写）
        </span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border/60 bg-background p-0.5">
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                source === "article"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSourceChange("article")}
            >
              本课 ({articleVocab.length})
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                source === "saved"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSourceChange("saved")}
              disabled={savedVocab.length === 0}
            >
              生词本 ({savedVocab.length})
            </button>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={handleRegenerate} title="重新出题">
            <Shuffle className="h-3 w-3" />
            换题
          </Button>
        </div>
      </div>

      {submitted ? (
        <div className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm",
          correctCount === questions.length
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : correctCount >= questions.length / 2
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
        )}>
          <span className="font-medium">得分 {correctCount} / {questions.length}</span>
          <span className="text-xs opacity-80">
            {correctCount === questions.length ? "全部正确！" : correctCount >= questions.length / 2 ? "不错，继续加油" : "再练几次就熟了"}
          </span>
        </div>
      ) : null}

      <div className="space-y-4">
        {questions.map((q, qIdx) => {
          const userAnswer = answers[qIdx] ?? "";
          const isCorrect = submitted && normalize(userAnswer) === normalize(q.word.word);
          const isWrong = submitted && !isCorrect;
          const isRevealed = revealed.has(qIdx);
          return (
            <div
              key={`${q.word.word}-${qIdx}`}
              className={cn(
                "rounded-xl border bg-card p-4 sm:p-5",
                submitted && isCorrect && "border-emerald-400/60",
                submitted && isWrong && "border-rose-400/60",
                !submitted && "border-border/60",
              )}
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {qIdx + 1}
                </span>
                <div className="flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="bg-amber-100/70 text-[10px] text-amber-900">
                      {q.word.partOfSpeech}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">释义：{q.word.definition}</span>
                  </div>
                  <p className="text-[15px] leading-7 text-foreground">
                    {q.sentenceBefore}
                    <span className="inline-flex items-baseline align-baseline">
                      <Input
                        type="text"
                        value={userAnswer}
                        onChange={(e) => handleAnswerChange(qIdx, e.target.value)}
                        disabled={submitted}
                        placeholder="_____"
                        className={cn(
                          "mx-1 inline-block h-7 w-28 border-dashed px-2 py-0 text-sm",
                          submitted && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-900",
                          submitted && isWrong && "border-rose-500 bg-rose-50 text-rose-900",
                          !submitted && "border-ring/40",
                        )}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </span>
                    {q.sentenceAfter}
                  </p>
                </div>
              </div>
              {submitted ? (
                <div className={cn(
                  "ml-9 flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  isCorrect ? "border-emerald-200 bg-emerald-50/60 text-emerald-900" : "border-rose-200 bg-rose-50/60 text-rose-900",
                )}>
                  {isCorrect ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}
                  <span className="flex-1">
                    {isCorrect ? (
                      <>正确！</>
                    ) : (
                      <>
                        正确答案：<span className="font-semibold">{q.word.word}</span>
                        {userAnswer.trim() && (
                          <span className="ml-2 opacity-70">（你的答案：{userAnswer}）</span>
                        )}
                      </>
                    )}
                    {q.word.phonetic ? (
                      <span className="ml-2 font-mono text-xs opacity-70">{q.word.phonetic}</span>
                    ) : null}
                  </span>
                </div>
              ) : isRevealed ? (
                <div className="ml-9 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
                  <Lightbulb className="h-4 w-4 shrink-0" />
                  <span>提示：<span className="font-semibold">{q.word.word}</span></span>
                </div>
              ) : (
                <div className="ml-9">
                  <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px] text-muted-foreground" onClick={() => handleReveal(qIdx)}>
                    <Eye className="h-3 w-3" />
                    看答案
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!submitted ? (
          <Button type="button" onClick={() => setSubmitted(true)} disabled={!allAnswered} className="gap-2">
            提交并查看结果
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            重做本题
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={handleRegenerate} className="gap-2 text-xs">
          <Shuffle className="h-3.5 w-3.5" />
          换一批题
        </Button>
        {!allAnswered && !submitted ? (
          <span className="text-xs text-muted-foreground">
            还有 {questions.length - answers.filter((a) => a.trim()).length} 题未填
          </span>
        ) : null}
      </div>
    </div>
  );
}
