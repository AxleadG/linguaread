"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AnalysisResult, ArticleHistoryEntry } from "./types";

const STORAGE_KEY = "english-learning:article-history";
const EVENT_NAME = "english-learning:article-history-changed";
const MAX_ENTRIES = 30;

const EMPTY: ArticleHistoryEntry[] = [];

function isBrowser() {
  return typeof window !== "undefined";
}

function isValidEntry(v: unknown): v is ArticleHistoryEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.text === "string" &&
    typeof o.timestamp === "number" &&
    typeof o.result === "object" &&
    o.result !== null
  );
}

let cachedRaw: string | null = null;
let cachedEntries: ArticleHistoryEntry[] = EMPTY;

function readFromStorage(): ArticleHistoryEntry[] {
  if (!isBrowser()) return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedEntries;
  cachedRaw = raw;
  if (!raw) {
    cachedEntries = EMPTY;
    return EMPTY;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedEntries = EMPTY;
      return EMPTY;
    }
    cachedEntries = parsed.filter(isValidEntry) as ArticleHistoryEntry[];
    return cachedEntries;
  } catch {
    cachedEntries = EMPTY;
    return EMPTY;
  }
}

function writeToStorage(entries: ArticleHistoryEntry[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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

function getSnapshot(): ArticleHistoryEntry[] {
  return readFromStorage();
}

function getServerSnapshot(): ArticleHistoryEntry[] {
  return EMPTY;
}

function makeTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 60) return trimmed;
  return trimmed.slice(0, 57) + "…";
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useArticleHistory() {
  const entries = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const addArticle = useCallback((text: string, result: AnalysisResult) => {
    const current = readFromStorage();
    const filtered = current.filter((e) => e.text !== text);
    const entry: ArticleHistoryEntry = {
      id: makeId(),
      title: makeTitle(text),
      text,
      result,
      timestamp: Date.now(),
    };
    const next = [entry, ...filtered].slice(0, MAX_ENTRIES);
    writeToStorage(next);
  }, []);

  const removeArticle = useCallback((id: string) => {
    const current = readFromStorage();
    writeToStorage(current.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    writeToStorage([]);
  }, []);

  return { entries, addArticle, removeArticle, clearAll };
}
