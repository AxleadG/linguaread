"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { VocabItem } from "./types";

const STORAGE_KEY = "english-learning:saved-vocab";
const EVENT_NAME = "english-learning:vocab-changed";

const EMPTY: VocabItem[] = [];

function isBrowser() {
  return typeof window !== "undefined";
}

// Cache of parsed vocab, keyed by the raw localStorage string.
// This ensures `getSnapshot` returns a stable reference when the underlying
// value hasn't changed (a requirement of useSyncExternalStore).
let cachedRaw: string | null = null;
let cachedItems: VocabItem[] = EMPTY;

function readFromStorage(): VocabItem[] {
  if (!isBrowser()) return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // Return cached array if the raw string hasn't changed.
  if (raw === cachedRaw) {
    return cachedItems;
  }
  cachedRaw = raw;
  if (!raw) {
    cachedItems = EMPTY;
    return EMPTY;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedItems = EMPTY;
      return EMPTY;
    }
    cachedItems = parsed.filter(
      (v) => v && typeof v.word === "string" && v.word.length > 0,
    ) as VocabItem[];
    return cachedItems;
  } catch {
    cachedItems = EMPTY;
    return EMPTY;
  }
}

function writeToStorage(items: VocabItem[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    // Invalidate cache so the next read picks up the new value.
    cachedRaw = null;
    // Notify same-tab subscribers (storage event only fires cross-tab).
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

function getSnapshot(): VocabItem[] {
  return readFromStorage();
}

function getServerSnapshot(): VocabItem[] {
  return EMPTY;
}

/**
 * Saved-vocabulary hook backed by localStorage.
 *
 * Uses `useSyncExternalStore` so the React 19 set-state-in-effect lint rule
 * is satisfied and cross-tab updates are reflected automatically.
 * Mutations go through `writeToStorage`, which emits a custom event so
 * same-tab subscribers re-render.
 */
export function useSavedVocab() {
  const saved = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const isSaved = useCallback(
    (word: string) => {
      const w = word.toLowerCase().trim();
      return saved.some((v) => v.word.toLowerCase() === w);
    },
    [saved],
  );

  const toggleSave = useCallback((item: VocabItem) => {
    const w = item.word.toLowerCase().trim();
    const current = readFromStorage();
    const exists = current.some((v) => v.word.toLowerCase() === w);
    const next = exists
      ? current.filter((v) => v.word.toLowerCase() !== w)
      : [...current, { ...item, word: item.word.trim() }];
    writeToStorage(next);
  }, []);

  const remove = useCallback((word: string) => {
    const w = word.toLowerCase().trim();
    const current = readFromStorage();
    writeToStorage(current.filter((v) => v.word.toLowerCase() !== w));
  }, []);

  const clear = useCallback(() => {
    writeToStorage([]);
  }, []);

  return { saved, isSaved, toggleSave, remove, clear };
}
