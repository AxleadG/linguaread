"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  findVoiceByURI,
  pickDefaultEnglishVoice,
  useVoicePrefs,
} from "./useVoicePrefs";

interface SpeakOptions {
  /** Override the stored rate for this single call. */
  rate?: number;
  pitch?: number;
  volume?: number;
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
 * A store that exposes the live list of available SpeechSynthesisVoice
 * objects. Voices are populated asynchronously (the browser may need to
 * query the OS), so we subscribe to the `voiceschanged` event and also
 * poll a few times as a fallback (Chrome sometimes never fires the event).
 */
let voicesCache: SpeechSynthesisVoice[] | null = null;
// Stable empty array reference so useSyncExternalStore doesn't loop when
// voices are still loading.
const EMPTY_VOICES: SpeechSynthesisVoice[] = [];
const VOICES_EVENT = "english-learning:voices-changed";

function readVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return EMPTY_VOICES;
  }
  const fresh = window.speechSynthesis.getVoices();
  if (fresh.length > 0) {
    voicesCache = fresh;
    return fresh;
  }
  return voicesCache ?? EMPTY_VOICES;
}

function notifyVoicesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VOICES_EVENT));
}

function subscribeVoices(callback: () => void): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  const handler = () => {
    voicesCache = null; // invalidate
    callback();
  };
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  window.addEventListener(VOICES_EVENT, handler);
  // Polling fallback: Chrome sometimes never fires `voiceschanged`.
  // Check every 250ms for the first 3 seconds.
  let polls = 0;
  const maxPolls = 12;
  const interval = window.setInterval(() => {
    polls += 1;
    const current = window.speechSynthesis.getVoices();
    if (current.length > 0) {
      voicesCache = null;
      notifyVoicesChanged();
      window.clearInterval(interval);
      return;
    }
    if (polls >= maxPolls) {
      window.clearInterval(interval);
    }
  }, 250);
  return () => {
    window.speechSynthesis.removeEventListener("voiceschanged", handler);
    window.removeEventListener(VOICES_EVENT, handler);
    window.clearInterval(interval);
  };
}

function getVoicesSnapshot(): SpeechSynthesisVoice[] {
  return readVoices();
}

function getVoicesServerSnapshot(): SpeechSynthesisVoice[] {
  return EMPTY_VOICES;
}

/**
 * Client-side TTS hook built on the Web Speech API.
 *
 * - In Edge browser: uses Microsoft neural voices (Aria, Guy, Jenny, etc.)
 *   — same engine as Edge's built-in "Read Aloud" feature.
 * - In Chrome: uses Google neural voices.
 * - In Safari: uses Siri/Apple voices.
 * - Falls back to system TTS on Firefox/older browsers.
 *
 * Voice preference and rate are persisted in localStorage via useVoicePrefs.
 */
export function useTTS() {
  const supported = useSyncExternalStore(
    subscribeSupported,
    getSpeechSupported,
    () => false,
  );
  const voices = useSyncExternalStore(
    subscribeVoices,
    getVoicesSnapshot,
    getVoicesServerSnapshot,
  );
  const { prefs } = useVoicePrefs();

  const [speaking, setSpeaking] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  // Resolve the active voice: user preference > default English pick > none.
  const activeVoice = (() => {
    if (!supported || voices.length === 0) return null;
    if (prefs.preferredVoiceURI) {
      const found = findVoiceByURI(voices, prefs.preferredVoiceURI);
      if (found) return found;
    }
    return pickDefaultEnglishVoice(voices);
  })();

  // Keep ref in sync for use inside the speak callback without re-creating it
  // on every voice change.
  const activeVoiceRef = useRef<SpeechSynthesisVoice | null>(activeVoice);
  useEffect(() => {
    activeVoiceRef.current = activeVoice;
  }, [activeVoice]);

  // Cancel any pending speech when the component unmounts.
  useEffect(() => {
    if (!supported) return;
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    };
  }, [supported]);

  // Chrome has a long-standing bug where long utterances stop after ~15s.
  // The standard workaround is to call resume() periodically while speaking.
  useEffect(() => {
    if (!supported) return;
    const interval = window.setInterval(() => {
      if (!speaking) return;
      // If the synth thinks it's speaking but is actually paused (the bug),
      // resume it.
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [supported, speaking]);

  const speak = useCallback(
    (text: string, key?: string, opts: SpeakOptions = {}) => {
      if (!supported || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      const voice = activeVoiceRef.current;
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else {
        utter.lang = "en-US";
      }
      utter.rate = opts.rate ?? prefs.rate ?? 0.95;
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

      // Small delay to let cancel() complete — some browsers race otherwise.
      window.setTimeout(() => synth.speak(utter), 0);
    },
    [supported, prefs.rate],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeakingKey(null);
  }, [supported]);

  return {
    supported,
    speaking,
    speakingKey,
    speak,
    stop,
    voices,
    activeVoice,
    rate: prefs.rate,
  };
}
