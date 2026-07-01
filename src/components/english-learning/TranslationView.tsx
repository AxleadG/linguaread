"use client";

import { useMemo } from "react";
import { Volume2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTTS } from "@/lib/english-learning/useTTS";
import { cn } from "@/lib/utils";

interface TranslationViewProps {
  source: string;
  translation: string;
}

export function TranslationView({ source, translation }: TranslationViewProps) {
  const tts = useTTS();

  const sourceParagraphs = useMemo(
    () =>
      source
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    [source],
  );
  const translationParagraphs = useMemo(
    () =>
      translation
        .split(/\n\s*\n|(?<=。)\s+(?=[^。])/)
        .map((p) => p.trim())
        .filter(Boolean),
    [translation],
  );

  const pairs = useMemo(() => {
    const max = Math.max(sourceParagraphs.length, translationParagraphs.length);
    return Array.from({ length: max }, (_, i) => ({
      source: sourceParagraphs[i] ?? "",
      translation: translationParagraphs[i] ?? "",
    }));
  }, [sourceParagraphs, translationParagraphs]);

  const speakParagraph = (paragraph: string, idx: number) => {
    if (tts.speakingKey === `trans:${idx}`) {
      tts.stop();
      return;
    }
    tts.speak(paragraph, `trans:${idx}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">对照翻译</span>
          {" · "}
          英文与中文逐段对照，方便跟读和精读
        </span>
        {tts.supported ? (
          <span className="flex items-center gap-1 text-xs">
            <Volume2 className="h-3.5 w-3.5" />
            点击英文段落右上角朗读（仅读英文）
          </span>
        ) : null}
      </div>

      {pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          暂无翻译结果
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-3 rounded-lg border border-border/50 bg-card p-4 sm:grid-cols-2 sm:gap-5 sm:p-5"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-primary/70">
                    English
                  </div>
                  {tts.supported && pair.source ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-6 gap-1 px-1.5 text-[11px]",
                        tts.speakingKey === `trans:${i}`
                          ? "text-primary"
                          : "text-muted-foreground opacity-60 hover:opacity-100",
                      )}
                      onClick={() => speakParagraph(pair.source, i)}
                      title={
                        tts.speakingKey === `trans:${i}` ? "暂停" : "朗读英文"
                      }
                    >
                      {tts.speakingKey === `trans:${i}` ? (
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
                </div>
                <p className="text-[15px] leading-7 text-foreground sm:text-base sm:leading-8">
                  {pair.source || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700/80">
                  中文
                </div>
                <p className="text-[15px] leading-8 text-foreground/90 sm:text-base sm:leading-8">
                  {pair.translation || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
