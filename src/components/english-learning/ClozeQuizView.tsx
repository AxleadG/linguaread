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
  apiConfig?: import("@/lib/english-learning/types").ApiConfig | null;
}

interface ClozeQuestion {
  word: VocabItem;
  sentenceBefore: string;
  sentenceAfter: string;
  fullSentence: string;
  chineseTranslation: string; // full-sentence Chinese translation
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
      chineseTranslation: "", // fetched lazily by TypingMode
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Typing mode: 汉译英 with per-word input boxes (句乐部 style)
//
// Shows the full Chinese sentence. Below it, a row of colored input
// boxes — one per English word in the target sentence. The user types
// each word; pressing space auto-advances to the next box. Each box
// shows real-time green/red feedback. Press Enter to submit.
// ─────────────────────────────────────────────────────────────

/** Normalize a word for comparison: lowercase, strip punctuation. */
function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/[.,!?;:"'`()]/g, "");
}

/**
 * Split a sentence into tokens: words + non-words (spaces, punctuation).
 * Returns array of { value, isWord }.
 */
function splitTokens(sentence: string): { value: string; isWord: boolean }[] {
  const tokens: { value: string; isWord: boolean }[] = [];
  const re = /([A-Za-z][A-Za-z''-]*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    if (m.index > last) {
      tokens.push({ value: sentence.slice(last, m.index), isWord: false });
    }
    tokens.push({ value: m[0], isWord: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) {
    tokens.push({ value: sentence.slice(last), isWord: false });
  }
  return tokens;
}

/** Extract only the word tokens from a sentence. */
function splitWords(sentence: string): string[] {
  return splitTokens(sentence)
    .filter((t) => t.isWord)
    .map((t) => t.value);
}

interface WordComparison {
  target: string;
  typed: string;
  correct: boolean;
}

function TypingMode({ questions, apiConfig }: { questions: ClozeQuestion[]; apiConfig?: import("@/lib/english-learning/types").ApiConfig | null }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [combo, setCombo] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  // Chinese translations for each question (fetched lazily).
  const [translations, setTranslations] = useState<Record<number, string>>({});

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

  // Fetch Chinese translation for the current question if not already fetched.
  useEffect(() => {
    if (!current || translations[currentIdx]) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/translate-phrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: current.fullSentence,
          config: apiConfig,
        }),
      });
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { translation?: string };
        if (data.translation) {
          setTranslations((prev) => ({ ...prev, [currentIdx]: data.translation }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentIdx, current, translations, apiConfig]);

  if (!current) return null;

  const targetSentence = current.fullSentence;
  const targetWords = splitWords(targetSentence);
  const chineseText = translations[currentIdx] || current.word.definition;

  const correctCount = completed.filter(Boolean).length;
  const progress = ((currentIdx + (submitted && completed.length > currentIdx ? 1 : 0)) / questions.length) * 100;
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  const handleReset = () => {
    setCurrentIdx(0);
    setCompleted([]);
    setCombo(0);
    setSubmitted(false);
    setStartTime(Date.now());
    setElapsed(0);
  };

  const handleNext = () => {
    if (!isLast) {
      setCurrentIdx((i) => i + 1);
      setSubmitted(false);
    }
  };

  const handleSubmit = (isCorrect: boolean) => {
    setSubmitted(true);
    setCompleted((prev) => {
      const next = [...prev];
      next[currentIdx] = isCorrect;
      return next;
    });
    if (isCorrect) {
      setCombo((c) => c + 1);
      if (isLast) {
        setStartTime(null);
      } else {
        setTimeout(() => {
          setCurrentIdx((i) => i + 1);
          setSubmitted(false);
        }, 1500);
      }
    } else {
      setCombo(0);
    }
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

      {/* Main card — keyed by currentIdx so it remounts per question */}
      <WordBoxCard
        key={currentIdx}
        question={current}
        chineseText={chineseText}
        targetSentence={targetSentence}
        targetWords={targetWords}
        submitted={submitted}
        isLast={isLast}
        onSubmit={handleSubmit}
        onNext={handleNext}
        onMount={() => {
          setStartTime(Date.now());
          setElapsed(0);
          setSubmitted(false);
        }}
      />

      {/* Completion screen */}
      {isLast && submitted && completed[questions.length - 1] ? (
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

/**
 * WordBoxCard: the main interactive component.
 * Shows Chinese sentence + a row of per-word input boxes.
 */
function WordBoxCard({
  question,
  chineseText,
  targetSentence,
  targetWords,
  submitted,
  isLast,
  onSubmit,
  onNext,
  onMount,
}: {
  question: ClozeQuestion;
  chineseText: string;
  targetSentence: string;
  targetWords: string[];
  submitted: boolean;
  isLast: boolean;
  onSubmit: (isCorrect: boolean) => void;
  onNext: () => void;
  onMount: () => void;
}) {
  // One input value per target word.
  const [inputs, setInputs] = useState<string[]>(() => targetWords.map(() => ""));
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // On mount, reset timer and focus first input.
  useEffect(() => {
    onMount();
    inputRefs.current[0]?.focus();
  }, [onMount]);

  // Compute word-level comparison.
  const comparison: WordComparison[] = targetWords.map((tw, i) => {
    const typed = (inputs[i] ?? "").trim();
    return {
      target: tw,
      typed,
      correct: normalizeWord(typed) === normalizeWord(tw),
    };
  });

  const allFilled = inputs.every((v) => v.trim().length > 0);
  const isCorrect = allFilled && comparison.every((c) => c.correct);

  const handleInputChange = (idx: number, value: string) => {
    if (submitted) return;
    // If the user typed a space, split on space and advance.
    if (value.includes(" ")) {
      const parts = value.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        setInputs((prev) => {
          const next = [...prev];
          next[idx] = parts[0];
          // If there's a second part, put it in the next box.
          if (parts.length > 1 && idx + 1 < targetWords.length) {
            next[idx + 1] = parts.slice(1).join(" ");
          }
          return next;
        });
        // Advance to next box
        if (idx + 1 < targetWords.length) {
          setActiveIdx(idx + 1);
          inputRefs.current[idx + 1]?.focus();
        }
        return;
      }
    }
    // Normal: just update this box
    setInputs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (submitted) {
        if (isCorrect) onNext();
        return;
      }
      if (allFilled) {
        onSubmit(isCorrect);
      }
      return;
    }
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      // If current box has content, advance to next
      if ((inputs[idx] ?? "").trim() && idx + 1 < targetWords.length) {
        setActiveIdx(idx + 1);
        inputRefs.current[idx + 1]?.focus();
      }
      return;
    }
    if (e.key === "Backspace") {
      // If current box is empty and not first, go back to previous
      if (!(inputs[idx] ?? "").trim() && idx > 0) {
        e.preventDefault();
        setActiveIdx(idx - 1);
        inputRefs.current[idx - 1]?.focus();
      }
    }
  };

  // Color palette for the boxes — cycle through pleasing colors
  const boxColors = [
    "border-emerald-300 bg-emerald-50/40 focus:border-emerald-500",
    "border-sky-300 bg-sky-50/40 focus:border-sky-500",
    "border-violet-300 bg-violet-50/40 focus:border-violet-500",
    "border-amber-300 bg-amber-50/40 focus:border-amber-500",
    "border-rose-300 bg-rose-50/40 focus:border-rose-500",
    "border-teal-300 bg-teal-50/40 focus:border-teal-500",
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm sm:p-8">
      {/* Word info badge */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
          {question.word.partOfSpeech} {question.word.word}
        </Badge>
        {question.word.phonetic ? (
          <span className="font-mono text-xs text-muted-foreground">{question.word.phonetic}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">共 {targetWords.length} 词</span>
      </div>

      {/* Chinese translation (full sentence) */}
      <div className="mb-6 rounded-lg border border-amber-200/50 bg-amber-50/40 p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700/70">
          中文翻译
        </div>
        <p className="text-lg leading-relaxed text-foreground sm:text-xl">{chineseText}</p>
      </div>

      {/* Word input boxes */}
      <div className="mb-4">
        <div className="mb-2 text-xs text-muted-foreground">
          填入英文单词（空格跳到下一个，回车提交）
        </div>
        <div className="flex flex-wrap gap-2">
          {targetWords.map((tw, i) => {
            const colorClass = boxColors[i % boxColors.length];
            const typed = inputs[i] ?? "";
            const isCorrect = normalizeWord(typed) === normalizeWord(tw);
            const showFeedback = typed.trim().length > 0;

            // After submit: show green for correct, red for wrong
            const finalClass = submitted
              ? isCorrect
                ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                : "border-rose-500 bg-rose-100 text-rose-800"
              : showFeedback
                ? isCorrect
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-rose-400 bg-rose-50 text-rose-700"
                : colorClass;

            return (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                value={typed}
                onChange={(e) => handleInputChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onFocus={() => setActiveIdx(i)}
                disabled={submitted}
                placeholder="·"
                className={cn(
                  "h-10 rounded-lg border-2 px-2 text-center text-base font-medium transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-ring/20",
                  finalClass,
                  i === activeIdx && !submitted && "ring-2 ring-ring/30",
                )}
                style={{
                  width: `${Math.max(48, Math.min(120, tw.length * 12 + 16))}px`,
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            );
          })}
        </div>
      </div>

      {/* After submit: show the correct sentence */}
      {submitted ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-700/70">
              正确答案
            </div>
            <p className="text-base leading-relaxed text-foreground">{targetSentence}</p>
          </div>
          {!isCorrect ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm text-amber-900">
              {comparison.map((c, i) => {
                if (c.correct) return null;
                return (
                  <span key={i} className="mr-2">
                    <span className="font-mono text-rose-600 line-through">{c.typed || "（空）"}</span>
                    {" → "}
                    <span className="font-mono font-semibold text-emerald-700">{c.target}</span>
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {!submitted ? (
          <Button
            size="sm"
            onClick={() => onSubmit(isCorrect)}
            disabled={!allFilled}
            className="gap-1.5"
          >
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
        {!submitted && !allFilled ? (
          <span className="text-xs text-muted-foreground">
            还差 {targetWords.length - inputs.filter((v) => v.trim()).length} 词
          </span>
        ) : null}
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
export function ClozeQuizView({ articleVocab, savedVocab, apiConfig }: ClozeQuizViewProps) {
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
          <>⌨️ <span className="font-medium">汉译英</span>：看整句中文翻译，依次在每个彩色框里填入英文单词。空格跳到下一个，回车提交。不区分大小写。</>
        )}
      </div>

      {/* Render the selected mode */}
      <div key={`${mode}-${seed}-${source}`}>
        {mode === "cloze" ? (
          <ClozeMode questions={questions} />
        ) : (
          <TypingMode questions={questions} apiConfig={apiConfig} />
        )}
      </div>
    </div>
  );
}
