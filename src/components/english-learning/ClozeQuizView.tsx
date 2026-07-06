"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  X,
  RotateCcw,
  Lightbulb,
  Shuffle,
  Eye,
  Keyboard,
  PencilLine,
  Timer,
  Flame,
  Trophy,
  ArrowRight,
} from "lucide-react";
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

type QuizMode = "cloze" | "typing";

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

// ─────────────────────────────────────────────────────────────
// Typing mode: 汉译英 (Chinese → English translation typing)
// Shows the Chinese translation, user types the English sentence.
// Word-level comparison with character-level visual feedback.
// ─────────────────────────────────────────────────────────────

/** Normalize a word for comparison: lowercase, strip punctuation. */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[.,!?;:"'`()]/g, "");
}

/** Split a sentence into "word" tokens (ignoring pure whitespace/punct). */
function splitWords(sentence: string): string[] {
  return (sentence.match(/[A-Za-z''-]+/g) ?? []).filter(Boolean);
}

interface WordComparison {
  target: string;
  typed: string | null;
  correct: boolean;
}

function TypingMode({ questions }: { questions: ClozeQuestion[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = questions[currentIdx];
  const isLast = currentIdx >= questions.length - 1;

  useEffect(() => {
    if (startTime === null) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const targetSentence = current?.fullSentence ?? "";
  const targetWords = useMemo(() => splitWords(targetSentence), [targetSentence]);
  const typedWords = useMemo(() => splitWords(input), [input]);

  const comparison: WordComparison[] = useMemo(() => {
    return targetWords.map((tw, i) => {
      const twNorm = normalizeWord(tw);
      const typed = i < typedWords.length ? typedWords[i] : null;
      const correct = typed !== null && normalizeWord(typed) === twNorm;
      return { target: tw, typed, correct };
    });
  }, [targetWords, typedWords]);

  const isCorrect = useMemo(() => {
    if (typedWords.length !== targetWords.length) return false;
    return comparison.every((c) => c.correct);
  }, [typedWords, targetWords, comparison]);

  const hasInput = typedWords.length > 0;

  const handleSubmit = useCallback(() => {
    if (!hasInput) return;
    setSubmitted(true);
    if (isCorrect) {
      setCompleted((prev) => [...prev, true]);
      setCombo((c) => c + 1);
      if (isLast) {
        setStartTime(null);
      } else {
        setTimeout(() => {
          setCurrentIdx((i) => i + 1);
        }, 1500);
      }
    } else {
      setCompleted((prev) => [...prev, false]);
      setCombo(0);
    }
  }, [hasInput, isCorrect, isLast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (submitted && isCorrect && !isLast) {
        setCurrentIdx((i) => i + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setInput("");
    setCompleted([]);
    setCombo(0);
    setSubmitted(false);
    setStartTime(Date.now());
    setElapsed(0);
  };

  if (!current) return null;

  const correctCount = completed.filter(Boolean).length;
  const progress = ((currentIdx + (submitted && isCorrect ? 1 : 0)) / questions.length) * 100;
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const chineseHint = current.word.definition;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Check className="h-4 w-4" />} label="已通过" value={`${correctCount}/${questions.length}`} color="emerald" />
        <StatCard icon={<Flame className="h-4 w-4" />} label="连击" value={`${combo}`} color="amber" />
        <StatCard icon={<Timer className="h-4 w-4" />} label="用时" value={formatTime(elapsed)} color="sky" />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="进度" value={`${Math.round(progress)}%`} color="violet" />
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <TypingCard
        key={currentIdx}
        question={current}
        chineseHint={chineseHint}
        targetSentence={targetSentence}
        targetWords={targetWords}
        input={input}
        setInput={setInput}
        comparison={comparison}
        submitted={submitted}
        isCorrect={isCorrect}
        isLast={isLast}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        onSubmit={handleSubmit}
        onNext={() => setCurrentIdx((i) => i + 1)}
        onResetTimer={() => {
          setStartTime(Date.now());
          setElapsed(0);
          setInput("");
          setSubmitted(false);
        }}
      />

      {isLast && submitted && isCorrect && completed.length === questions.length ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-amber-50 p-6 text-center">
          <Trophy className="mx-auto h-10 w-10 text-amber-500" />
          <h3 className="mt-2 text-lg font-semibold">全部完成！</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            正确 {correctCount}/{questions.length} · 用时 {formatTime(elapsed)} · 最高连击 {combo}
          </p>
          <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            再来一轮
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TypingCard({
  question,
  chineseHint,
  targetSentence,
  targetWords,
  input,
  setInput,
  comparison,
  submitted,
  isCorrect,
  isLast,
  onKeyDown,
  inputRef,
  onSubmit,
  onNext,
  onResetTimer,
}: {
  question: ClozeQuestion;
  chineseHint: string;
  targetSentence: string;
  targetWords: string[];
  input: string;
  setInput: (v: string) => void;
  comparison: WordComparison[];
  submitted: boolean;
  isCorrect: boolean;
  isLast: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onNext: () => void;
  onResetTimer: () => void;
}) {
  useEffect(() => {
    inputRef.current?.focus();
    onResetTimer();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm sm:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
          {question.word.partOfSpeech}
        </Badge>
        {question.word.phonetic ? (
          <span className="font-mono text-xs text-muted-foreground">{question.word.phonetic}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">共 {targetWords.length} 词</span>
      </div>

      <div className="mb-6 rounded-lg border border-amber-200/50 bg-amber-50/40 p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700/70">
          中文释义
        </div>
        <p className="text-lg leading-relaxed text-foreground sm:text-xl">{chineseHint}</p>
      </div>

      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="用英文打出包含这个单词的句子..."
          disabled={submitted && isCorrect}
          className={cn(
            "h-12 border-2 text-lg",
            submitted && isCorrect && "border-emerald-500 bg-emerald-50",
            submitted && !isCorrect && "border-rose-500 bg-rose-50",
            !submitted && "border-ring/30",
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {submitted && isCorrect ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
        ) : null}
      </div>

      {!submitted && input.trim() ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {comparison.map((c, i) => {
            if (c.typed === null) return null;
            return (
              <span
                key={i}
                className={cn(
                  "rounded-md px-2 py-0.5 text-sm font-medium",
                  c.correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                )}
              >
                {c.typed}
              </span>
            );
          })}
        </div>
      ) : null}

      {submitted ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-700/70">
              正确答案
            </div>
            <p className="text-base leading-relaxed text-foreground">{targetSentence}</p>
          </div>
          {input.trim() ? (
            <div className="rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                你的答案
              </div>
              <p className="flex flex-wrap gap-1 text-base leading-relaxed">
                {comparison.map((c, i) => {
                  if (c.typed === null) return null;
                  return (
                    <span
                      key={i}
                      className={cn(
                        "rounded px-1",
                        c.correct ? "text-emerald-600" : "text-rose-500 line-through",
                      )}
                    >
                      {c.typed}
                    </span>
                  );
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        {!submitted ? (
          <Button size="sm" onClick={onSubmit} disabled={!input.trim()} className="gap-1.5">
            提交
            <Check className="h-3.5 w-3.5" />
          </Button>
        ) : isCorrect ? (
          !isLast ? (
            <Button size="sm" onClick={onNext} className="gap-1.5">
              下一句
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : null
        ) : (
          <Button size="sm" variant="outline" onClick={onNext} className="gap-1.5">
            跳过
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cloze mode: fill in the blank (beautified version)
// ─────────────────────────────────────────────────────────────
function ClozeMode({ questions }: { questions: ClozeQuestion[] }) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const [submitted, setSubmitted] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);

  // Reset when questions change
  const [lastKey, setLastKey] = useState("");
  const currentKey = questions.map((q) => q.word.word).join(",");
  if (currentKey !== lastKey) {
    setLastKey(currentKey);
    setAnswers(questions.map(() => ""));
    setSubmitted(false);
    setRevealed(new Set());
    setCurrentIdx(0);
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
    setCurrentIdx(0);
  };

  const allAnswered = answers.every((a) => a.trim().length > 0);
  const correctCount = submitted
    ? answers.filter((a, i) => normalize(a) === normalize(questions[i].word.word)).length
    : 0;
  const progress = ((currentIdx + 1) / questions.length) * 100;

  const current = questions[currentIdx];

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Check className="h-4 w-4" />} label="当前" value={`${currentIdx + 1}/${questions.length}`} color="emerald" />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label={submitted ? "得分" : "进度"}
          value={submitted ? `${correctCount}/${questions.length}` : `${Math.round(progress)}%`}
          color="violet"
        />
        <StatCard icon={<Flame className="h-4 w-4" />} label="已答" value={`${answers.filter((a) => a.trim()).length}`} color="amber" />
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current question card (one at a time, like 句乐部) */}
      {current ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
              {current.word.partOfSpeech}
            </Badge>
            <span className="text-sm text-muted-foreground">
              释义：<span className="font-medium text-foreground">{current.word.definition}</span>
            </span>
            {current.word.phonetic ? (
              <span className="font-mono text-xs text-muted-foreground">{current.word.phonetic}</span>
            ) : null}
          </div>

          <p className="mb-6 text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
            {current.sentenceBefore}
            <span className="inline-flex items-baseline align-baseline">
              <Input
                type="text"
                value={answers[currentIdx] ?? ""}
                onChange={(e) => handleAnswerChange(currentIdx, e.target.value)}
                disabled={submitted}
                placeholder="_____"
                className={cn(
                  "mx-1 inline-block h-9 w-32 border-2 border-dashed px-2 text-center text-lg",
                  submitted && normalize(answers[currentIdx] ?? "") === normalize(current.word.word) && "border-emerald-500 bg-emerald-50 text-emerald-900",
                  submitted && normalize(answers[currentIdx] ?? "") !== normalize(current.word.word) && "border-rose-500 bg-rose-50 text-rose-900",
                  !submitted && "border-ring/40",
                )}
                autoComplete="off"
                spellCheck={false}
              />
            </span>
            {current.sentenceAfter}
          </p>

          {/* Feedback */}
          {submitted ? (
            <div className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
              normalize(answers[currentIdx] ?? "") === normalize(current.word.word)
                ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                : "border-rose-200 bg-rose-50/80 text-rose-900",
            )}>
              {normalize(answers[currentIdx] ?? "") === normalize(current.word.word) ? (
                <Check className="h-5 w-5 shrink-0" />
              ) : (
                <X className="h-5 w-5 shrink-0" />
              )}
              <span className="flex-1">
                {normalize(answers[currentIdx] ?? "") === normalize(current.word.word) ? (
                  <>正确！</>
                ) : (
                  <>
                    正确答案：<span className="font-semibold">{current.word.word}</span>
                    {(answers[currentIdx] ?? "").trim() && (
                      <span className="ml-2 opacity-70">（你的答案：{answers[currentIdx]}）</span>
                    )}
                  </>
                )}
              </span>
            </div>
          ) : revealed.has(currentIdx) ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Lightbulb className="h-4 w-4 shrink-0" />
              <span>提示：<span className="font-semibold">{current.word.word}</span></span>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-5 flex items-center gap-2">
            {!submitted && !revealed.has(currentIdx) ? (
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => handleReveal(currentIdx)}>
                <Eye className="h-3.5 w-3.5" />
                看答案
              </Button>
            ) : null}
            {!submitted && currentIdx < questions.length - 1 ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setCurrentIdx((i) => i + 1)}
                disabled={!answers[currentIdx]?.trim()}
              >
                下一题
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {!submitted && currentIdx === questions.length - 1 ? (
              <Button size="sm" onClick={() => setSubmitted(true)} disabled={!allAnswered} className="gap-1.5">
                <Check className="h-3.5 w-3.5" />
                提交查看结果
              </Button>
            ) : null}
            {submitted ? (
              <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                重做
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Completion screen */}
      {submitted ? (
        <div className={cn(
          "rounded-2xl border p-6 text-center",
          correctCount === questions.length
            ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-amber-50"
            : correctCount >= questions.length / 2
              ? "border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50"
              : "border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50",
        )}>
          <Trophy className={cn(
            "mx-auto h-10 w-10",
            correctCount === questions.length ? "text-amber-500" : "text-muted-foreground",
          )} />
          <h3 className="mt-2 text-lg font-semibold">
            {correctCount === questions.length ? "全部正确！" : `得分 ${correctCount}/${questions.length}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {correctCount === questions.length ? "太棒了！" : correctCount >= questions.length / 2 ? "不错，继续加油" : "再练几次就熟了"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat card component
// ─────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "emerald" | "amber" | "sky" | "violet";
}) {
  const colorMap = {
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    sky: "text-sky-600 bg-sky-50 border-sky-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
  };
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", colorMap[color])}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
        <div className="truncate text-sm font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export function ClozeQuizView({ articleVocab, savedVocab }: ClozeQuizViewProps) {
  const [mode, setMode] = useState<QuizMode>("cloze");
  const [source, setSource] = useState<"article" | "saved">(() =>
    savedVocab.length >= 4 ? "saved" : "article",
  );
  const [seed, setSeed] = useState(0);

  const pool = source === "saved" ? savedVocab : articleVocab;
  const questions = useMemo(() => {
    return buildClozeQuestions(pool, 8);
  }, [source, seed, pool]);

  const handleRegenerate = () => setSeed((s) => s + 1);
  const handleSourceChange = (newSource: "article" | "saved") => {
    setSource(newSource);
    setSeed((s) => s + 1);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <PencilLine className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <div className="mt-3 text-sm text-muted-foreground">
          {source === "saved"
            ? "生词本中没有带例句的单词。请在精读模式下收藏一些单词后再来练习。"
            : "本课生词中没有可用于填空练习的单词（需要单词带有原文例句）。"}
        </div>
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

  return (
    <div className="space-y-5">
      {/* Mode + source switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">练习方式：</span>
          <div className="flex rounded-lg border border-border/60 bg-background p-0.5">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "cloze"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode("cloze")}
            >
              <PencilLine className="h-3.5 w-3.5" />
              挖词填空
            </button>
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "typing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode("typing")}
            >
              <Keyboard className="h-3.5 w-3.5" />
              汉译英
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/60 bg-background p-0.5">
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
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
                "rounded-md px-2.5 py-1.5 text-xs transition-colors",
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
          <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs" onClick={handleRegenerate} title="重新出题">
            <Shuffle className="h-3 w-3" />
            换题
          </Button>
        </div>
      </div>

      {/* Mode description */}
      <div className="rounded-lg bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        {mode === "cloze" ? (
          <>📝 <span className="font-medium">挖词填空</span>：根据释义和上下文，填入正确的单词。不区分大小写。</>
        ) : (
          <>⌨️ <span className="font-medium">汉译英</span>：看中文释义，用英文打出包含该单词的完整句子。不区分大小写和标点。按 Enter 提交。</>
        )}
      </div>

      {/* Render the selected mode */}
      <div key={`${mode}-${seed}-${source}`}>
        {mode === "cloze" ? (
          <ClozeMode questions={questions} />
        ) : (
          <TypingMode questions={questions} />
        )}
      </div>
    </div>
  );
}
