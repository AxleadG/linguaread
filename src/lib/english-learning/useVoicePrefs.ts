"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Voice preferences persisted in localStorage.
 *
 * `preferredVoiceURI` is the SpeechSynthesisVoice.voiceURI of the user's
 * chosen voice (stable across page loads within the same browser). If empty,
 * the hook picks a sensible default (American English, prefer male, prefer
 * Microsoft neural voices).
 */
export interface VoicePreferences {
  preferredVoiceURI: string;
  rate: number; // 0.5 – 2.0
}

const DEFAULT_PREFS: VoicePreferences = {
  preferredVoiceURI: "",
  rate: 0.95,
};

const STORAGE_KEY = "english-learning:voice-prefs";
const EVENT_NAME = "english-learning:voice-prefs-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

function isValidPrefs(v: unknown): v is VoicePreferences {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.preferredVoiceURI === "string" &&
    typeof o.rate === "number" &&
    o.rate >= 0.5 &&
    o.rate <= 2.0
  );
}

let cachedRaw: string | null = null;
let cachedPrefs: VoicePreferences = DEFAULT_PREFS;

function readFromStorage(): VoicePreferences {
  if (!isBrowser()) return DEFAULT_PREFS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PREFS;
  }
  if (raw === cachedRaw) return cachedPrefs;
  cachedRaw = raw;
  if (!raw) {
    cachedPrefs = DEFAULT_PREFS;
    return DEFAULT_PREFS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidPrefs(parsed)) {
      cachedPrefs = parsed;
      return parsed;
    }
  } catch {
    // fall through
  }
  cachedPrefs = DEFAULT_PREFS;
  return DEFAULT_PREFS;
}

function writeToStorage(prefs: VoicePreferences) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    cachedRaw = null;
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    // ignore quota errors
  }
}

function subscribe(callback: () => void) {
  if (!isBrowser()) return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): VoicePreferences {
  return readFromStorage();
}

function getServerSnapshot(): VoicePreferences {
  return DEFAULT_PREFS;
}

/** Preference ranking for picking a sensible default English voice. */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase();

  // Strongly prefer Microsoft neural voices (these are the high-quality
  // ones Edge ships with — Aria, Guy, Jenny, etc.).
  if (/microsoft.*neural/i.test(name)) score += 100;
  if (/microsoft/i.test(name)) score += 30;
  // Google neural voices (Chrome's default).
  if (/google/i.test(name)) score += 50;
  // Apple/Siri voices (Safari on Mac/iOS).
  if (/siri|apple/i.test(name)) score += 40;

  // Prefer US English (most learners want American accent).
  if (lang === "en-us") score += 20;
  else if (lang.startsWith("en")) score += 10;

  // Default-voice tiebreaker: prefer the OS-default if scores are close.
  if (v.default) score += 5;

  return score;
}

/** Score bonus for male voices, since the user requested American male. */
function maleBonus(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  // Microsoft male voices: Guy, Roger, Eric, Brian (GB), Ryan (GB)
  // Google male: typically named with "Male" suffix
  if (/guy|roger|eric|brian|ryan|male|james|david|mark/i.test(name)) {
    return 15;
  }
  return 0;
}

/**
 * Pick the best available English voice, preferring male neural voices.
 * Returns null if no English voice is available.
 */
export function pickDefaultEnglishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en/i.test(v.lang));
  if (english.length === 0) return null;
  return english
    .map((v) => ({ v, score: scoreVoice(v) + maleBonus(v) }))
    .sort((a, b) => b.score - a.score)[0]?.v ?? null;
}

/** Find a voice by URI; returns null if not found. */
export function findVoiceByURI(
  voices: SpeechSynthesisVoice[],
  uri: string,
): SpeechSynthesisVoice | null {
  if (!uri) return null;
  return voices.find((v) => v.voiceURI === uri) ?? null;
}

/** Filter voices to only English ones, sorted by quality score. */
export function listEnglishVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  return voices
    .filter((v) => /^en/i.test(v.lang))
    .map((v) => ({ v, score: scoreVoice(v) + maleBonus(v) }))
    .sort((a, b) => b.score - a.score)
    .map(({ v }) => v);
}

export function useVoicePrefs() {
  const prefs = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setPrefs = useCallback((next: Partial<VoicePreferences>) => {
    const current = readFromStorage();
    writeToStorage({ ...current, ...next });
  }, []);

  const setPreferredVoice = useCallback((voiceURI: string) => {
    setPrefs({ preferredVoiceURI: voiceURI });
  }, [setPrefs]);

  const setRate = useCallback((rate: number) => {
    setPrefs({ rate: Math.max(0.5, Math.min(2.0, rate)) });
  }, [setPrefs]);

  return { prefs, setPrefs, setPreferredVoice, setRate };
}
