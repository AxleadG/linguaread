"use client";

import { useState } from "react";
import {
  Settings2,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  KeyRound,
  Server,
  Cpu,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useApiConfig } from "@/lib/english-learning/useApiConfig";
import {
  API_PRESETS,
  type ApiConfig,
  type ApiPreset,
} from "@/lib/english-learning/types";
import { safeFetchJson } from "@/lib/english-learning/safe-fetch";
import { VoiceSettings } from "./VoiceSettings";

type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; reply: string }
  | { kind: "fail"; error: string };

interface SettingsFormProps {
  initialConfig: ApiConfig;
  onClose: () => void;
}

/**
 * Inner form. Mounted fresh each time the dialog opens, so its useState
 * initializers always run with the latest config from localStorage.
 * This avoids the React 19 "no setState in effect" lint rule.
 */
function SettingsForm({ initialConfig, onClose }: SettingsFormProps) {
  const { setConfig, reset } = useApiConfig();
  const [draft, setDraft] = useState<ApiConfig>(initialConfig);
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const matchedPreset: ApiPreset | undefined = API_PRESETS.find(
    (p) => p.baseUrl === draft.baseUrl.trim(),
  );

  const handlePresetSelect = (label: string) => {
    const preset = API_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setDraft((d) => ({
      ...d,
      baseUrl: preset.baseUrl,
      model: d.model || preset.defaultModel,
    }));
    setTest({ kind: "idle" });
  };

  const handleField = <K extends keyof ApiConfig>(
    key: K,
    value: ApiConfig[K],
  ) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setTest({ kind: "idle" });
  };

  const canTest =
    draft.enabled &&
    draft.baseUrl.trim() &&
    draft.apiKey.trim() &&
    draft.model.trim();

  const handleTest = async () => {
    if (!canTest) return;
    setTest({ kind: "testing" });
    const result = await safeFetchJson<{
      ok: boolean;
      reply?: string;
      error?: string;
    }>("/api/test-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: draft }),
    });
    if (!result.ok || !result.data?.ok) {
      const msg = result.error || result.data?.error || "测试失败";
      setTest({ kind: "fail", error: msg });
      toast.error("连接测试失败", { description: msg });
      return;
    }
    setTest({ kind: "ok", reply: result.data.reply ?? "" });
    toast.success("连接成功", {
      description: `模型回复：${result.data.reply ?? ""}`,
    });
  };

  const handleSave = () => {
    if (
      draft.enabled &&
      (!draft.baseUrl.trim() || !draft.apiKey.trim() || !draft.model.trim())
    ) {
      toast.error("启用自定义 API 需要填写 Base URL、API Key 和模型名称");
      return;
    }
    setConfig(draft);
    toast.success("设置已保存", {
      description: draft.enabled
        ? `已启用 ${draft.model}`
        : "已切换回内置 AI（DeepSeek）",
    });
    onClose();
  };

  const handleReset = () => {
    reset();
    setDraft({
      enabled: false,
      baseUrl: "",
      apiKey: "",
      model: "",
    });
    setTest({ kind: "idle" });
    toast.success("已重置为内置 AI");
  };

  return (
    <div className="space-y-4">
      {/* Enable switch */}
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-amber-600" />
            启用自定义 API
          </div>
          <p className="text-xs text-muted-foreground">
            关闭时使用内置 AI（DeepSeek）；开启后使用下方配置
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(v) => handleField("enabled", v)}
        />
      </div>

      {/* Preset picker */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          快速选择服务商
        </Label>
        <Select
          value={matchedPreset?.label ?? ""}
          onValueChange={handlePresetSelect}
          disabled={!draft.enabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择预设 / 或手动填写下方 Base URL" />
          </SelectTrigger>
          <SelectContent>
            {API_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.label}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {matchedPreset ? (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            申请 Key：{matchedPreset.hint}
          </p>
        ) : null}
      </div>

      {/* Base URL */}
      <div className="space-y-1.5">
        <Label
          htmlFor="api-base-url"
          className="flex items-center gap-1.5 text-xs"
        >
          <Server className="h-3.5 w-3.5" />
          Base URL
        </Label>
        <Input
          id="api-base-url"
          type="url"
          placeholder="https://api.openai.com/v1"
          value={draft.baseUrl}
          onChange={(e) => handleField("baseUrl", e.target.value)}
          disabled={!draft.enabled}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          需以 http:// 或 https:// 开头；OpenAI/Kimi/通义通常以 /v1 结尾，DeepSeek 直接填 https://api.deepseek.com
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <Label htmlFor="api-key" className="flex items-center gap-1.5 text-xs">
          <KeyRound className="h-3.5 w-3.5" />
          API Key
        </Label>
        <Input
          id="api-key"
          type="password"
          placeholder="sk-..."
          value={draft.apiKey}
          onChange={(e) => handleField("apiKey", e.target.value)}
          disabled={!draft.enabled}
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          仅保存在浏览器 localStorage，不会上传到服务器
        </p>
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <Label
          htmlFor="api-model"
          className="flex items-center gap-1.5 text-xs"
        >
          <Cpu className="h-3.5 w-3.5" />
          模型名称
        </Label>
        <Input
          id="api-model"
          type="text"
          placeholder={matchedPreset?.defaultModel ?? "gpt-4o-mini"}
          value={draft.model}
          onChange={(e) => handleField("model", e.target.value)}
          disabled={!draft.enabled}
          autoComplete="off"
          spellCheck={false}
          list="api-model-list"
        />
        <datalist id="api-model-list">
          {(matchedPreset?.models ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {matchedPreset ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {matchedPreset.models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleField("model", m)}
                className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Test result */}
      {test.kind !== "idle" ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
            test.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : test.kind === "fail"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          {test.kind === "testing" ? (
            <>
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
              <span>测试中…</span>
            </>
          ) : test.kind === "ok" ? (
            <>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">连接成功</div>
                <div className="truncate text-xs opacity-80">
                  模型回复：{test.reply}
                </div>
              </div>
            </>
          ) : (
            <>
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium">连接失败</div>
                <div className="text-xs opacity-90">{test.error}</div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Voice / TTS settings */}
      <VoiceSettings />

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mr-auto gap-1.5 text-xs"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置为内置
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!canTest || test.kind === "testing"}
          className="gap-1.5"
        >
          {test.kind === "testing" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          测试连接
        </Button>
        <Button type="button" size="sm" onClick={handleSave} className="gap-1.5">
          保存
        </Button>
      </div>
    </div>
  );
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { config } = useApiConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            AI 模型与朗读设置
          </DialogTitle>
          <DialogDescription>
            配置 AI 模型（默认 DeepSeek，可填自定义 OpenAI 兼容 API）和朗读音色（推荐 Edge 浏览器，自带微软神经语音）。所有数据仅保存在本地浏览器。
          </DialogDescription>
        </DialogHeader>

        {/* Only mount the form when open, so its useState initializers
            always re-run with the latest config from localStorage. */}
        {open ? <SettingsForm initialConfig={config} onClose={() => onOpenChange(false)} /> : null}

        {/* Status badge */}
        <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
          <Badge
            variant="secondary"
            className={
              config.enabled
                ? "bg-amber-100/70 text-amber-900"
                : "bg-emerald-100/70 text-emerald-900"
            }
          >
            当前：{config.enabled ? `自定义 · ${config.model}` : "内置 · DeepSeek"}
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
