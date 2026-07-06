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

/** Split a sentence into tokens for character-level typing comparison. */
function tokenizeForTyping(sentence: string): string[] {
  // Split into words and non-words (spaces, punctuation), preserving order.
  return sentence.match(/\s+|[^\s]+/g) ?? [sentence];
}

// ─────────────────────────────────────────────────────────────
// Typing mode: type the full sentence with character-level feedback
// ─────────────────────────────────────────────────────────────
function TypingMode({ questions }: { questions: ClozeQuestion[] }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = questions[currentIdx];
  const isLast = currentIdx >= questions.length - 1;

  // Timer
  useEffect(() => {
    if (startTime === null) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const target = current?.fullSentence ?? "";

  // Character-by-character comparison for visual feedback
  const comparison = useMemo(() => {
    const chars: { expected: string; typed: string | null; correct: boolean }[] = [];
    for (let i = 0; i < target.length; i++) {
      const expected = target[i];
      const typed = i < input.length ? input[i] : null;
      chars.push({
        expected,
        typed,
        correct: typed !== null && typed.toLowerCase() === expected.toLowerCase(),
      });
    }
    return chars;
  }, [target, input]);

  const isComplete = input.length >= target.length;
  const isAllCorrect = isComplete && comparison.every((c) => c.correct);

  const handleSubmit = useCallback(() => {
    if (!isComplete) return;
    if (isAllCorrect) {
      setCompleted((prev) => [...prev, true]);
      setCombo((c) => c + 1);
      if (isLast) {
        setStartTime(null);
      } else {
        setTimeout(() => setCurrentIdx((i) => i + 1), 800);
      }
    } else {
      setCompleted((prev) => [...prev, false]);
      setCombo(0);
    }
  }, [isComplete, isAllCorrect, isLast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setInput("");
    setCompleted([]);
    setCombo(0);
    setStartTime(Date.now());
    setElapsed(0);
  };

  if (!current) return null;

  const correctCount = completed.filter(Boolean).length;
  const progress = ((currentIdx + (isAllCorrect ? 1 : 0)) / questions.length) * 100;
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Check className="h-4 w-4" />} label="已通过" value={`${correctCount}/${questions.length}`} color="emerald" />
        <StatCard icon={<Flame className="h-4 w-4" />} label="连击" value={`${combo}`} color="amber" />
        <StatCard icon={<Timer className="h-4 w-4" />} label="用时" value={formatTime(elapsed)} color="sky" />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="进度" value={`${Math.round(progress)}%`} color="violet" />
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main typing card — keyed by currentIdx so it remounts per question */}
      <TypingCard
        key={currentIdx}
        question={current}
        input={input}
        setInput={setInput}
        comparison={comparison}
        target={target}
        isComplete={isComplete}
        isAllCorrect={isAllCorrect}
        isLast={isLast}
        showHint={showHint}
        setShowHint={setShowHint}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        onResetTimer={() => {
          setStartTime(Date.now());
          setElapsed(0);
          setInput("");
          setShowHint(false);
        }}
      />

      {/* Completion screen */}
      {isLast && isAllCorrect && completed.length === questions.length ? (
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

// TypingCard is a separate component that remounts per question (via key),
// so it can use useState initializers + useEffect without the lint rule
// complaining about setState in effect.
function TypingCard({
  question,
  input,
  setInput,
  comparison,
  target,
  isComplete,
  isAllCorrect,
  isLast,
  showHint,
  setShowHint,
  onSubmit,
  onKeyDown,
  inputRef,
  onResetTimer,
}: {
  question: ClozeQuestion;
  input: string;
  setInput: (v: string) => void;
  comparison: { expected: string; typed: string | null; correct: boolean }[];
  target: string;
  isComplete: boolean;
  isAllCorrect: boolean;
  isLast: boolean;
  showHint: boolean;
  setShowHint: (v: boolean) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onResetTimer: () => void;
}) {
  // On mount, reset the timer and focus.
  useEffect(() => {
    inputRef.current?.focus();
    onResetTimer();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm sm:p-8">
      {/* Word info badge */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
          {question.word.partOfSpeech}
        </Badge>
        <span className="text-sm text-muted-foreground">
          释义：<span className="font-medium text-foreground">{question.word.definition}</span>
        </span>
        {question.word.phonetic ? (
          <span className="font-mono text-xs text-muted-foreground">{question.word.phonetic}</span>
        ) : null}
      </div>

      {/* Sentence display with character-level feedback */}
      <div className="mb-6 rounded-lg bg-background/60 p-4">
        <p className="flex flex-wrap text-xl leading-relaxed tracking-wide sm:text-2xl sm:leading-relaxed">
          {comparison.map((c, i) => {
            const isSpace = c.expected === " ";
            if (c.typed === null) {
              return (
                <span
                  key={i}
                  className={cn(
                    "border-b-2 border-muted-foreground/30",
                    isSpace ? "mx-0.5" : "",
                  )}
                >
                  {isSpace ? "\u00A0" : c.expected}
                </span>
              );
            }
            return (
              <span
                key={i}
                className={cn(
                  "transition-colors",
                  c.correct ? "text-emerald-600" : "text-rose-500 bg-rose-100 rounded",
                  isSpace ? "mx-0.5" : "",
                )}
              >
                {isSpace ? "\u00A0" : c.expected}
              </span>
            );
          })}
        </p>
      </div>

      {/* Input */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="开始打字..."
          className={cn(
            "h-12 border-2 text-lg",
            isComplete && isAllCorrect && "border-emerald-500 bg-emerald-50",
            isComplete && !isAllCorrect && "border-rose-500 bg-rose-50",
            !isComplete && "border-ring/30",
          )}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {isComplete && isAllCorrect ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Check className="h-6 w-6 text-emerald-500" />
          </div>
        ) : null}
      </div>

      {/* Hint */}
      {showHint ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Lightbulb className="h-4 w-4 shrink-0" />
          <span>提示：<span className="font-mono font-semibold">{question.word.word}</span></span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {!showHint ? (
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setShowHint(true)}>
            <Eye className="h-3.5 w-3.5" />
            看答案
          </Button>
        ) : null}
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!isComplete}
          className="gap-1.5"
        >
          {isLast ? "完成" : "下一句"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
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
              整句打字
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
          <>⌨️ <span className="font-medium">整句打字</span>：用键盘打出完整句子，每个字母都会即时反馈对错。打完按 Enter 提交。</>
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
