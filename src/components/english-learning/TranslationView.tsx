"use client";

import { useMemo } from "react";

interface TranslationViewProps {
  source: string;
  translation: string;
}

export function TranslationView({ source, translation }: TranslationViewProps) {
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

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">对照翻译</span>
        {" · "}
        英文与中文逐段对照，方便跟读和精读
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
                <div className="text-[11px] font-semibold uppercase tracking-wider text-primary/70">
                  English
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
