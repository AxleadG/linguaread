"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_API_CONFIG, type ApiConfig } from "./types";

const STORAGE_KEY = "english-learning:api-config";
const EVENT_NAME = "english-learning:api-config-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

function isValidConfig(c: unknown): c is ApiConfig {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.enabled === "boolean" &&
    typeof o.baseUrl === "string" &&
    typeof o.apiKey === "string" &&
    typeof o.model === "string"
  );
}

let cachedRaw: string | null = null;
let cachedConfig: ApiConfig = DEFAULT_API_CONFIG;

function readFromStorage(): ApiConfig {
  if (!isBrowser()) return DEFAULT_API_CONFIG;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_API_CONFIG;
  }
  if (raw === cachedRaw) return cachedConfig;
  cachedRaw = raw;
  if (!raw) {
    cachedConfig = DEFAULT_API_CONFIG;
    return DEFAULT_API_CONFIG;
  }
  try {
    const parsed = JSON.parse(raw);
    if (isValidConfig(parsed)) {
      cachedConfig = parsed;
      return parsed;
    }
  } catch {
    // fall through
  }
  cachedConfig = DEFAULT_API_CONFIG;
  return DEFAULT_API_CONFIG;
}

function writeToStorage(config: ApiConfig) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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

function getSnapshot(): ApiConfig {
  return readFromStorage();
}

function getServerSnapshot(): ApiConfig {
  return DEFAULT_API_CONFIG;
}

/**
 * Read/write the user's custom LLM API configuration from localStorage.
 *
 * The config is sent to the Next.js API route in the request body so the
 * backend can relay it to the actual LLM provider. The API key is only
 * stored locally in the user's browser.
 */
export function useApiConfig() {
  const config = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setConfig = useCallback((next: ApiConfig) => {
    writeToStorage(next);
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<ApiConfig>) => {
      const current = readFromStorage();
      writeToStorage({ ...current, ...patch });
    },
    [],
  );

  const reset = useCallback(() => {
    writeToStorage(DEFAULT_API_CONFIG);
  }, []);

  return { config, setConfig, updateConfig, reset };
}

/**
 * Returns a non-reactive getter for the current config, for use in event
 * handlers where we want to read the latest value without re-subscribing.
 */
export function readApiConfig(): ApiConfig {
  return readFromStorage();
}
