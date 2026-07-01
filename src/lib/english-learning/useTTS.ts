"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

interface SpeakOptions {
  rate?: number; // 0.5–2.0, default 0.95
  pitch?: number; // 0–2, default 1
  volume?: number; // 0–1, default 1
}

function getSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function subscribeSupported(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Some browsers populate speechSynthesis asynchronously.
  window.addEventListener("load", callback);
  return () => window.removeEventListener("load", callback);
}

/**
 * Client-side TTS hook built on the Web Speech API.
 * No backend round-trip needed; works offline once voices load.
 */
export function useTTS() {
  // `supported` is read from the browser via useSyncExternalStore so SSR
  // renders `false` and the client upgrades after hydration without
  // triggering the React 19 set-state-in-effect lint rule.
  const supported = useSyncExternalStore(
    subscribeSupported,
    getSpeechSupported,
    () => false,
  );

  const [speaking, setSpeaking] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!supported) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;
      // Prefer high-quality English voices
      const preferred =
        voices.find(
          (v) =>
            /en[-_]US/i.test(v.lang) &&
            /female|samantha|google/i.test(v.name),
        ) ||
        voices.find((v) => /en[-_]US/i.test(v.lang)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        voices[0];
      voiceRef.current = preferred ?? null;
    };
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, key?: string, opts: SpeakOptions = {}) => {
      if (!supported || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.lang = voiceRef.current?.lang || "en-US";
      utter.rate = opts.rate ?? 0.95;
      utter.pitch = opts.pitch ?? 1;
      utter.volume = opts.volume ?? 1;

      utter.onstart = () => {
        setSpeaking(true);
        setSpeakingKey(key ?? text);
      };
      utter.onend = () => {
        setSpeaking(false);
        setSpeakingKey(null);
      };
      utter.onerror = () => {
        setSpeaking(false);
        setSpeakingKey(null);
      };

      synth.speak(utter);
    },
    [supported],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeakingKey(null);
  }, [supported]);

  return { supported, speaking, speakingKey, speak, stop };
}
