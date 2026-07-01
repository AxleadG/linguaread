"use client";

import { useMemo } from "react";
import { Volume2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WordPopover } from "./WordPopover";
import type { VocabItem } from "@/lib/english-learning/types";
import { useTTS } from "@/lib/english-learning/useTTS";
import { cn } from "@/lib/utils";

interface ReadingModeProps {
  text: string;
  vocabulary: VocabItem[];
  savedWords: Set<string>;
  onToggleSave: (item: VocabItem) => void;
}

// Split a paragraph into tokens: words + non-words (whitespace/punctuation).
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

function findSentence(text: string, startIdx: number): string {
  // Find sentence boundaries around the given index.
  const left = Math.max(
    0,
    text.lastIndexOf(".", startIdx),
    text.lastIndexOf("!", startIdx),
    text.lastIndexOf("?", startIdx),
  );
  let right = text.length;
  for (const ch of [".", "!", "?"]) {
    const i = text.indexOf(ch, startIdx + 1);
    if (i !== -1 && i < right) right = i + 1;
  }
  return text.slice(left === 0 ? 0 : left + 1, right).trim();
}

export function ReadingMode({
  text,
  vocabulary,
  savedWords,
  onToggleSave,
}: ReadingModeProps) {
  const tts = useTTS();

  // Map lowercase word -> VocabItem (the AI-provided definition).
  const vocabMap = useMemo(() => {
    const m = new Map<string, VocabItem>();
    for (const v of vocabulary) {
      m.set(v.word.toLowerCase(), v);
    }
    return m;
  }, [vocabulary]);

  // Pre-compute paragraphs with tokenized content and word positions
  // (so we can derive the surrounding sentence on demand).
  const paragraphs = useMemo(() => {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const tokens = tokenize(p);
        // Build absolute positions for each word token.
        let pos = 0;
        const tokensWithPos = tokens.map((t) => {
          const start = pos;
          pos += t.value.length;
          return { ...t, start };
        });
        return { text: p, tokens: tokensWithPos };
      });
  }, [text]);

  const speakParagraph = (paragraph: string, idx: number) => {
    if (tts.speakingKey === `para:${idx}`) {
      tts.stop();
      return;
    }
    tts.speak(paragraph, `para:${idx}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">阅读模式</span>
          {" · "}
          点击任意单词查看释义，琥珀色下划线为本课重点词汇
        </div>
        {tts.supported ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5" />
            <span>支持段落朗读（浏览器语音合成）</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
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
                  <>
                    <Pause className="h-3 w-3" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    朗读
                  </>
                )}
              </Button>
            ) : null}
            <p className="text-[17px] leading-8 text-foreground sm:text-lg sm:leading-9">
              {para.tokens.map((tok, tIdx) => {
                if (tok.type === "other") {
                  return (
                    <span key={tIdx} className="whitespace-pre-wrap">
                      {tok.value}
                    </span>
                  );
                }
                const lower = tok.value.toLowerCase();
                const preset = vocabMap.get(lower);
                const highlighted = Boolean(preset);
                const context = findSentence(para.text, tok.start);
                return (
                  <WordPopover
                    key={tIdx}
                    word={tok.value}
                    preset={preset}
                    context={context}
                    saved={savedWords.has(lower)}
                    onToggleSave={onToggleSave}
                    onSpeak={tts.speak}
                    speakingKey={tts.speakingKey}
                    highlighted={highlighted}
                  >
                    {tok.value}
                  </WordPopover>
                );
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
