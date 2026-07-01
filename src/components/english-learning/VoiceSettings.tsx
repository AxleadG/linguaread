"use client";

import { useMemo, useState } from "react";
import { Volume2, Play, Square, Gauge, Mic2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTTS } from "@/lib/english-learning/useTTS";
import { useVoicePrefs, listEnglishVoices } from "@/lib/english-learning/useVoicePrefs";

interface VoiceSettingsProps {
  /** Disable everything (e.g. if TTS is not supported). */
  disabled?: boolean;
}

function describeVoice(v: SpeechSynthesisVoice): string {
  const name = v.name;
  const lang = v.lang;
  // Try to extract a friendlier provider label.
  let provider = "";
  if (/microsoft/i.test(name)) provider = "Microsoft · ";
  else if (/google/i.test(name)) provider = "Google · ";
  else if (/apple|siri/i.test(name)) provider = "Apple · ";
  return `${provider}${name} (${lang})`;
}

function voiceQualityHint(v: SpeechSynthesisVoice): string {
  const name = v.name.toLowerCase();
  if (/microsoft.*neural/i.test(name)) return "神经语音";
  if (/google/i.test(name)) return "神经语音";
  if (/siri/i.test(name)) return "Siri";
  if (/natural/i.test(name)) return "自然语音";
  return "系统语音";
}

/**
 * Voice + rate preference UI. Lives inside the SettingsDialog.
 * Reads available voices from the browser via useTTS, lets the user pick
 * one and preview it, and persists the choice via useVoicePrefs.
 */
export function VoiceSettings({ disabled }: VoiceSettingsProps) {
  const { supported, voices, speak, stop, speaking, speakingKey } = useTTS();
  const { prefs, setPreferredVoice, setRate } = useVoicePrefs();
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  const englishVoices = useMemo(() => listEnglishVoices(voices), [voices]);

  const selectedURI =
    prefs.preferredVoiceURI ||
    englishVoices[0]?.voiceURI ||
    "";

  const handlePreview = (voiceURI: string) => {
    if (!supported || englishVoices.length === 0) return;
    // If currently previewing this voice, stop.
    if (speaking && previewingURI === voiceURI) {
      stop();
      setPreviewingURI(null);
      return;
    }
    const voice = englishVoices.find((v) => v.voiceURI === voiceURI);
    if (!voice) return;
    setPreviewingURI(voiceURI);
    // Use a sample sentence that exercises common phonemes.
    const sample =
      "The quick brown fox jumps over the lazy dog. Walking through the ancient forest, I was struck by how quiet it was.";
    const utter = new SpeechSynthesisUtterance(sample);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = prefs.rate;
    utter.onend = () => setPreviewingURI(null);
    utter.onerror = () => setPreviewingURI(null);
    // Cancel any current speech first.
    window.speechSynthesis.cancel();
    window.setTimeout(() => {
      window.speechSynthesis.speak(utter);
    }, 0);
  };

  if (!supported) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
        <div className="flex items-center gap-1.5 font-medium">
          <Mic2 className="h-3.5 w-3.5" />
          当前浏览器不支持语音朗读
        </div>
        <p className="mt-1 opacity-80">
          建议使用 Microsoft Edge / Chrome / Safari 浏览器以获得最佳朗读体验。Edge 浏览器内置微软神经语音（Guy / Aria / Jenny），音质最佳。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">朗读音色</span>
        </div>
        <Badge variant="secondary" className="bg-emerald-100/70 text-emerald-900">
          {englishVoices.length} 个英文音色
        </Badge>
      </div>

      {/* Voice picker */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          选择英文朗读音色（Edge 浏览器推荐微软神经语音）
        </Label>
        <div className="flex gap-2">
          <Select
            value={selectedURI}
            onValueChange={(v) => setPreferredVoice(v)}
            disabled={disabled || englishVoices.length === 0}
          >
            <SelectTrigger className="flex-1">
              <SelectValue
                placeholder={
                  englishVoices.length === 0
                    ? "正在加载音色列表…"
                    : "选择音色"
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {englishVoices.map((v) => (
                <SelectItem
                  key={v.voiceURI}
                  value={v.voiceURI}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{describeVoice(v)}</span>
                  <Badge
                    variant="outline"
                    className="ml-2 shrink-0 text-[10px]"
                  >
                    {voiceQualityHint(v)}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => handlePreview(selectedURI)}
            disabled={
              disabled || !selectedURI || englishVoices.length === 0
            }
            title="试听当前选中的音色"
          >
            {previewingURI === selectedURI ? (
              <>
                <Square className="h-3.5 w-3.5" />
                停止
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                试听
              </>
            )}
          </Button>
        </div>
        {englishVoices.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            正在加载浏览器可用音色，请稍候…（首次加载可能需要 1-2 秒）
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {speaking && previewingURI ? "正在试听…" : "已保存的偏好会在所有朗读位置生效"}
          </p>
        )}
      </div>

      {/* Rate slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            朗读语速
          </Label>
          <Badge variant="secondary" className="text-[11px] tabular-nums">
            {prefs.rate.toFixed(2)}×
          </Badge>
        </div>
        <Slider
          value={[prefs.rate]}
          onValueChange={(vals) => {
            if (typeof vals[0] === "number") setRate(vals[0]);
          }}
          min={0.5}
          max={1.5}
          step={0.05}
          disabled={disabled}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>慢 0.5×</span>
          <span>正常 1.0×</span>
          <span>快 1.5×</span>
        </div>
      </div>

      {/* Tip */}
      <p className="rounded bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-5 text-amber-900/90">
        💡 推荐使用 <span className="font-medium">Microsoft Edge 浏览器</span>：内置微软神经语音（Guy 男声 / Aria 女声 / Jenny 女声），与 Edge 浏览器自带"朗读"功能同款，音质最佳且完全免费。
      </p>
    </div>
  );
}
