"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BookOpen,
  Sparkles,
  Loader2,
  Bookmark,
  Trash2,
  Wand2,
  Languages,
  ListChecks,
  HelpCircle,
  BookMarked,
  FileText,
  AlertCircle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ReadingMode } from "@/components/english-learning/ReadingMode";
import { TranslationView } from "@/components/english-learning/TranslationView";
import { VocabularyList } from "@/components/english-learning/VocabularyList";
import { QuizView } from "@/components/english-learning/QuizView";
import { SummaryView } from "@/components/english-learning/SummaryView";
import { SavedVocabDrawer } from "@/components/english-learning/SavedVocabDrawer";
import { SettingsDialog } from "@/components/english-learning/SettingsDialog";
import { SAMPLE_TEXTS } from "@/lib/english-learning/samples";
import { useSavedVocab } from "@/lib/english-learning/useSavedVocab";
import { useApiConfig } from "@/lib/english-learning/useApiConfig";
import { safeFetchJson } from "@/lib/english-learning/safe-fetch";
import type { AnalysisResult, VocabItem } from "@/lib/english-learning/types";

const MAX_CHARS = 8000;
const MIN_CHARS = 20;

export default function Home() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzedText, setAnalyzedText] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const savedVocab = useSavedVocab();
  const { config: apiConfig } = useApiConfig();

  const savedWords = useMemo(() => {
    return new Set(savedVocab.saved.map((v) => v.word.toLowerCase()));
  }, [savedVocab.saved]);

  const handleAnalyze = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(`请输入至少 ${MIN_CHARS} 个字符的英文材料。`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await safeFetchJson<AnalysisResult>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, config: apiConfig }),
      });
      if (!result.ok || !result.data) {
        const msg = result.error || "分析失败，请稍后重试。";
        throw new Error(msg);
      }
      const r = result.data;
      setResult(r);
      setAnalyzedText(trimmed);
      toast.success("分析完成", {
        description: `难度 ${r.difficulty} · ${r.vocabulary.length} 个生词 · ${r.questions.length} 道测验`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setError(msg);
      toast.error("分析失败", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [text, apiConfig]);

  const handleSample = useCallback((sampleText: string) => {
    setText(sampleText);
    setError(null);
    setResult(null);
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setResult(null);
    setError(null);
    setAnalyzedText("");
  }, []);

  const handleToggleSave = useCallback(
    (item: VocabItem) => {
      savedVocab.toggleSave(item);
      const saved = savedVocab.isSaved(item.word);
      toast.success(saved ? "已取消收藏" : "已加入生词本", {
        description: item.word,
      });
    },
    [savedVocab],
  );

  const charCount = text.trim().length;
  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">
                LinguaRead
              </div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">
                AI 英语精读助手
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setSettingsOpen(true)}
              title="AI 模型设置"
            >
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {apiConfig.enabled ? "自定义 API" : "AI 设置"}
              </span>
              {apiConfig.enabled ? (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 justify-center bg-amber-100/70 px-1.5 text-[11px] text-amber-900"
                >
                  ON
                </Badge>
              ) : null}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setDrawerOpen(true)}
            >
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">生词本</span>
              {savedVocab.saved.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 min-w-5 justify-center bg-primary/10 px-1.5 text-[11px] text-primary"
                >
                  {savedVocab.saved.length}
                </Badge>
              ) : null}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero (only when no analysis yet) */}
        {!result ? (
          <section className="mb-6 sm:mb-8">
            <div className="hero-gradient relative overflow-hidden rounded-2xl border border-border/60 px-6 py-8 sm:px-10 sm:py-10">
              <div className="paper-texture absolute inset-0" />
              <div className="relative">
                <Badge
                  variant="secondary"
                  className="mb-3 bg-white/70 text-foreground/80 backdrop-blur-sm"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI 驱动
                </Badge>
                <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  粘贴一段英文，让 AI 帮你逐句读懂它。
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px] sm:leading-7">
                  自动翻译全文、提炼重点生词、生成阅读理解题，并提供逐词点击查词、段落朗读和生词收藏。把任意英文材料变成一节属于你的精读课。
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Input section */}
        <section className={result ? "mb-6" : "mb-8"}>
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                英文材料
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{wordCount} 词</span>
                <span className="text-border">·</span>
                <span className={charCount > MAX_CHARS ? "text-destructive" : ""}>
                  {charCount} / {MAX_CHARS}
                </span>
              </div>
            </div>
            <div className="px-4 py-3 sm:px-5 sm:py-4">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="在此粘贴英文文章、新闻、故事、演讲稿等任意材料…&#10;&#10;Tips:&#10;- 建议字数 50–2000，效果最佳&#10;- 可粘贴 1–3 个段落"
                className="min-h-[180px] resize-y border-0 bg-transparent p-0 text-[15px] leading-7 shadow-none focus-visible:ring-0 sm:text-base sm:leading-8"
                maxLength={MAX_CHARS + 200}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">示例：</span>
                  {SAMPLE_TEXTS.map((s) => (
                    <Button
                      key={s.title}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => handleSample(s.text)}
                      disabled={loading}
                    >
                      <span className="max-w-[120px] truncate">{s.title}</span>
                      <Badge
                        variant="secondary"
                        className="h-4 bg-amber-100/60 px-1 text-[10px] text-amber-900"
                      >
                        {s.difficulty}
                      </Badge>
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {text ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleClear}
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      清空
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={handleAnalyze}
                    disabled={loading || charCount < MIN_CHARS}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        分析中…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        开始精读
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="leading-6">{error}</span>
            </div>
          ) : null}
        </section>

        {/* Loading skeleton */}
        {loading && !result ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card p-8">
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    AI 正在精读你的材料…
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    翻译 · 提炼生词 · 生成测验 · 解析语法
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-border/40 bg-muted/40"
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Results */}
        {result ? (
          <section className="space-y-4">
            {/* Result meta row */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 bg-emerald-100/70 text-emerald-900">
                  <BookMarked className="h-3 w-3" />
                  难度 {result.difficulty}
                </Badge>
                {result.topic && result.topic !== "未识别" ? (
                  <Badge variant="secondary" className="bg-amber-100/70 text-amber-900">
                    {result.topic}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {result.vocabulary.length} 生词 · {result.questions.length} 题 ·{" "}
                  {result.grammarPoints.length} 语法点
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleClear}
              >
                换一段材料
              </Button>
            </div>

            <Tabs defaultValue="reading" className="w-full">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1 sm:grid sm:grid-cols-5">
                <TabsTrigger
                  value="reading"
                  className="gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>精读</span>
                </TabsTrigger>
                <TabsTrigger
                  value="translation"
                  className="gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>对照</span>
                </TabsTrigger>
                <TabsTrigger
                  value="vocabulary"
                  className="gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  <span>生词</span>
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 min-w-4 justify-center bg-primary/10 px-1 text-[10px] text-primary"
                  >
                    {result.vocabulary.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="summary"
                  className="gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  <span>摘要</span>
                </TabsTrigger>
                <TabsTrigger
                  value="quiz"
                  className="gap-1.5 py-2 text-xs sm:text-sm"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>测验</span>
                  {result.questions.length > 0 ? (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-4 min-w-4 justify-center bg-primary/10 px-1 text-[10px] text-primary"
                    >
                      {result.questions.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="reading" className="mt-4">
                <ReadingMode
                  text={analyzedText}
                  vocabulary={result.vocabulary}
                  savedWords={savedWords}
                  onToggleSave={handleToggleSave}
                  apiConfig={apiConfig}
                />
              </TabsContent>

              <TabsContent value="translation" className="mt-4">
                <TranslationView
                  source={analyzedText}
                  translation={result.translation}
                />
              </TabsContent>

              <TabsContent value="vocabulary" className="mt-4">
                <VocabularyList
                  vocabulary={result.vocabulary}
                  savedWords={savedWords}
                  onToggleSave={handleToggleSave}
                />
              </TabsContent>

              <TabsContent value="summary" className="mt-4">
                <SummaryView
                  summary={result.summary}
                  keyPoints={result.keyPoints}
                  grammarPoints={result.grammarPoints}
                  difficulty={result.difficulty}
                  topic={result.topic}
                />
              </TabsContent>

              <TabsContent value="quiz" className="mt-4">
                <QuizView key={analyzedText} questions={result.questions} />
              </TabsContent>
            </Tabs>
          </section>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
          LinguaRead · 基于 AI 的英文精读工具 · 所有生词本仅保存在本地浏览器
        </div>
      </footer>

      <SavedVocabDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        items={savedVocab.saved}
        onRemove={savedVocab.remove}
        onClear={savedVocab.clear}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
