"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Volume2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WordPopover } from "./WordPopover";
import { SelectionPopover } from "./SelectionPopover";
import type { ApiConfig, VocabItem } from "@/lib/english-learning/types";
import { useTTS } from "@/lib/english-learning/useTTS";
import { cn } from "@/lib/utils";

interface ReadingModeProps {
  text: string;
  vocabulary: VocabItem[];
  savedWords: Set<string>;
  onToggleSave: (item: VocabItem) => void;
  apiConfig?: ApiConfig | null;
}

const TOKEN_RE = /([A-Za-z][A-Za-z'-]*(?:'[A-Za-z]+)?)/g;

interface Token {
  type: "word" | "other";
  value: string;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) {
      tokens.push({ type: "other", value: text.slice(last, m.index) });
    }
    tokens.push({ type: "word", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    tokens.push({ type: "other", value: text.slice(last) });
  }
  return tokens;
}

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+["'')\]]*(?=\s|$)|[^.!?]+$/g);
  if (!matches) return [text];
  return matches.map((s) => s.trim()).filter(Boolean);
}

interface SelectionState {
  text: string;
  rect: DOMRect;
  context: string;
}

interface FlatWord {
  globalIdx: number;
  value: string;
  sentenceText: string;
}

export function ReadingMode({
  text,
  vocabulary,
  savedWords,
  onToggleSave,
  apiConfig,
}: ReadingModeProps) {
  const tts = useTTS();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);

  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartIdxRef = useRef<number | null>(null);
  const dragEndIdxRef = useRef<number | null>(null);
  const dragInProgressRef = useRef(false);
  const popoverShownAtRef = useRef<number>(0);

  const vocabMap = useMemo(() => {
    const m = new Map<string, VocabItem>();
    for (const v of vocabulary) m.set(v.word.toLowerCase(), v);
    return m;
  }, [vocabulary]);

  const { paragraphs, flatWords } = useMemo(() => {
    let wordCounter = 0;
    const flat: FlatWord[] = [];
    const paras = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const sentences = splitIntoSentences(p);
        return {
          text: p,
          sentences: sentences.map((s) => {
            const tokens = tokenize(s);
            const tokensWithIdx = tokens.map((t) => {
              if (t.type === "word") {
                const idx = wordCounter++;
                flat.push({ globalIdx: idx, value: t.value, sentenceText: s });
                return { ...t, globalIdx: idx };
              }
              return { ...t, globalIdx: null as number | null };
            });
            return { text: s, tokens: tokensWithIdx };
          }),
        };
      });
    return { paragraphs: paras, flatWords: flat };
  }, [text]);

  const flatWordsMap = useMemo(() => {
    const m = new Map<number, FlatWord>();
    for (const w of flatWords) m.set(w.globalIdx, w);
    return m;
  }, [flatWords]);

  const speakParagraph = (paragraph: string, idx: number) => {
    if (tts.speakingKey === `para:${idx}`) {
      tts.stop();
      return;
    }
    tts.speak(paragraph, `para:${idx}`);
  };

  const speakSentence = (sentenceText: string, key: string) => {
    if (tts.speakingKey === key) {
      tts.stop();
      return;
    }
    tts.speak(sentenceText, key);
  };

  const highlightedWordIndices = useMemo(() => {
    if (dragStartIdx === null || dragEndIdx === null) return new Set<number>();
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    const s = new Set<number>();
    for (let i = lo; i <= hi; i++) s.add(i);
    return s;
  }, [dragStartIdx, dragEndIdx]);

  const setDragStart = useCallback((idx: number | null) => {
    dragStartIdxRef.current = idx;
    setDragStartIdx(idx);
  }, []);
  const setDragEnd = useCallback((idx: number | null) => {
    dragEndIdxRef.current = idx;
    setDragEndIdx(idx);
  }, []);

  const getWordIdxFromButton = (btn: HTMLElement): number | null => {
    const idx = btn.getAttribute("data-word-idx");
    return idx !== null ? parseInt(idx, 10) : null;
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (
        selectionState &&
        (e.target as HTMLElement).closest("[data-selection-popover]")
      ) {
        return;
      }
      if (selectionState && popoverShownAtRef.current) {
        const elapsed = Date.now() - popoverShownAtRef.current;
        if (elapsed < 300) return;
      }
      if (selectionState) {
        setSelectionState(null);
      }
      setDragStart(null);
      setDragEnd(null);

      const target = e.target as HTMLElement;
      const wordBtn = target.closest('button[data-word-idx]');
      if (wordBtn) {
        const idx = getWordIdxFromButton(wordBtn);
        if (idx !== null && !Number.isNaN(idx)) {
          mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
          isDraggingRef.current = false;
          dragInProgressRef.current = true;
          setDragStart(idx);
          setDragEnd(idx);
          e.preventDefault();
        }
      }
    },
    [selectionState, setDragStart, setDragEnd],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragInProgressRef.current) return;
      const startIdx = dragStartIdxRef.current;
      if (startIdx === null) return;
      const down = mouseDownPosRef.current;
      if (down && !isDraggingRef.current) {
        const dx = Math.abs(e.clientX - down.x);
        const dy = Math.abs(e.clientY - down.y);
        if (dx > 5 || dy > 5) {
          isDraggingRef.current = true;
        } else {
          return;
        }
      }
      let wordBtn: HTMLElement | null = null;
      const target = e.target as HTMLElement;
      if (target) {
        wordBtn = target.closest('button[data-word-idx]');
      }
      if (!wordBtn) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) wordBtn = (el as HTMLElement).closest('button[data-word-idx]');
      }
      if (wordBtn) {
        const idx = getWordIdxFromButton(wordBtn);
        if (idx !== null && !Number.isNaN(idx)) {
          setDragEnd(idx);
        }
      }
    },
    [setDragEnd],
  );

  const handleMouseUp = useCallback(
    () => {
      dragInProgressRef.current = false;
      const startIdx = dragStartIdxRef.current;
      const endIdx = dragEndIdxRef.current;
      if (startIdx === null || endIdx === null) return;
      if (!isDraggingRef.current) {
        setDragStart(null);
        setDragEnd(null);
        mouseDownPosRef.current = null;
        return;
      }
      isDraggingRef.current = false;
      mouseDownPosRef.current = null;

      const lo = Math.min(startIdx, endIdx);
      const hi = Math.max(startIdx, endIdx);

      const firstBtn = containerRef.current?.querySelector(
        `button[data-word-idx="${lo}"]`,
      ) as HTMLElement | null;
      const lastBtn = containerRef.current?.querySelector(
        `button[data-word-idx="${hi}"]`,
      ) as HTMLElement | null;
      if (!firstBtn || !lastBtn) {
        setDragStart(null);
        setDragEnd(null);
        return;
      }
      const firstRect = firstBtn.getBoundingClientRect();
      const lastRect = lastBtn.getBoundingClientRect();
      const left = Math.min(firstRect.left, lastRect.left);
      const right = Math.max(firstRect.right, lastRect.right);
      const top = Math.min(firstRect.top, lastRect.top);
      const bottom = Math.max(firstRect.bottom, lastRect.bottom);
      const rect = new DOMRect(left, top, right - left, bottom - top);

      const firstWord = flatWordsMap.get(lo);
      const lastWord = flatWordsMap.get(hi);
      if (!firstWord || !lastWord) {
        setDragStart(null);
        setDragEnd(null);
        return;
      }
      let selectedText: string;
      let context: string;
      if (firstWord.sentenceText === lastWord.sentenceText) {
        context = firstWord.sentenceText;
        const startInSent = firstWord.sentenceText.indexOf(firstWord.value);
        const endInSent = lastWord.sentenceText.indexOf(lastWord.value) + lastWord.value.length;
        selectedText = firstWord.sentenceText.slice(startInSent, endInSent).trim();
      } else {
        const words: string[] = [];
        for (let i = lo; i <= hi; i++) {
          const w = flatWordsMap.get(i);
          if (w) words.push(w.value);
        }
        selectedText = words.join(" ");
        context = firstWord.sentenceText;
      }

      if (selectedText && selectedText.length >= 2) {
        popoverShownAtRef.current = Date.now();
        setSelectionState({ text: selectedText, rect, context });
      } else {
        setDragStart(null);
        setDragEnd(null);
      }
    },
    [flatWordsMap, setDragStart, setDragEnd],
  );

  const handleClosePopover = useCallback(() => {
    setSelectionState(null);
    setDragStart(null);
    setDragEnd(null);
  }, [setDragStart, setDragEnd]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">精读模式</span>
          {" · "}
          点击单词查释义，按住拖动选多个词翻译，悬停句子显示朗读按钮
        </div>
        {tts.supported ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" />
            <span>支持句子/段落朗读</span>
          </div>
        ) : null}
      </div>

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="select-none space-y-5"
      >
        {paragraphs.map((para, pIdx) => (
          <div
            key={pIdx}
            className="group relative rounded-lg border border-border/50 bg-card px-4 py-4 sm:px-6 sm:py-5"
          >
            {tts.supported ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "absolute right-2 top-2 h-7 gap-1 px-2 text-xs opacity-60 transition-opacity",
                  "group-hover:opacity-100",
                  tts.speakingKey === `para:${pIdx}` && "opacity-100",
                )}
                onClick={() => speakParagraph(para.text, pIdx)}
                title={tts.speakingKey === `para:${pIdx}` ? "暂停" : "朗读本段"}
              >
                {tts.speakingKey === `para:${pIdx}` ? (
                  <><Pause className="h-3 w-3" />暂停</>
                ) : (
                  <><Play className="h-3 w-3" />朗读</>
                )}
              </Button>
            ) : null}

            <div className="space-y-2.5 pr-12">
              {para.sentences.map((sent, sIdx) => {
                const sentenceKey = `sent:${pIdx}-${sIdx}`;
                const isSpeakingSentence = tts.speakingKey === sentenceKey;
                return (
                  <div key={sIdx} data-sentence={sent.text} className="group/sent relative">
                    {tts.supported ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "absolute -left-1 top-1 h-6 w-6 -translate-x-full p-0 opacity-0 transition-opacity",
                          "group-hover/sent:opacity-60 hover:!opacity-100",
                          isSpeakingSentence && "opacity-100",
                        )}
                        onClick={() => speakSentence(sent.text, sentenceKey)}
                        title={isSpeakingSentence ? "暂停" : "朗读本句"}
                      >
                        {isSpeakingSentence ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                    ) : null}
                    <p
                      className={cn(
                        "rounded px-1 text-[17px] leading-8 text-foreground transition-colors sm:text-lg sm:leading-9",
                        isSpeakingSentence && "bg-amber-100/40",
                      )}
                    >
                      {sent.tokens.map((tok, tIdx) => {
                        if (tok.type === "other") {
                          return (
                            <span key={tIdx} className="whitespace-pre-wrap">{tok.value}</span>
                          );
                        }
                        const lower = tok.value.toLowerCase();
                        const preset = vocabMap.get(lower);
                        const highlighted = Boolean(preset);
                        const isSelected =
                          tok.globalIdx !== null &&
                          highlightedWordIndices.has(tok.globalIdx);
                        return (
                          <WordPopover
                            key={tIdx}
                            word={tok.value}
                            preset={preset}
                            context={sent.text}
                            saved={savedWords.has(lower)}
                            onToggleSave={onToggleSave}
                            onSpeak={tts.speak}
                            speakingKey={tts.speakingKey}
                            highlighted={highlighted}
                            selected={isSelected}
                            apiConfig={apiConfig}
                            wordIdx={tok.globalIdx}
                          >
                            {tok.value}
                          </WordPopover>
                        );
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectionState ? (
        <div data-selection-popover>
          <SelectionPopover
            text={selectionState.text}
            rect={selectionState.rect}
            context={selectionState.context}
            apiConfig={apiConfig}
            onClose={handleClosePopover}
          />
        </div>
      ) : null}
    </div>
  );
}
