import { useState, useEffect } from "react";

type Dictionary = Record<string, unknown>;

interface I18nState {
  locale: string;
  dictionary: Dictionary;
  fallbackDictionary: Dictionary;
  initPromise: Promise<Dictionary> | null;
}

const state: I18nState = {
  locale: "en",
  dictionary: {},
  fallbackDictionary: {},
  initPromise: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function resolveKey(obj: unknown, key: string): unknown {
  if (!obj || !key) return undefined;
  let value: unknown = obj;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function interpolate(template: unknown, params: Record<string, unknown> | null): string {
  if (typeof template !== "string") return template == null ? "" : String(template);
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    if (params && Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token]);
    }
    return `{${token}}`;
  });
}

let tomlCache: Dictionary | null = null;
async function fetchLangJson(locale: string): Promise<Dictionary> {
  const response = await fetch(`/assets/locales.toml`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load locales.toml: ${response.status}`);
  }
  if (!tomlCache) {
    const root: Dictionary = {};
    let cursor: Dictionary | null = null;
    for (const line of (await response.text()).split(/\r?\n/)) {
      const table = line.match(/^\[([\w.-]+)\]$/);
      if (table) {
        cursor = root;
        const parts = table[1].split(".");
        for (const part of parts) cursor = (cursor[part] ??= {}) as Dictionary;
      } else if (cursor && line.trim()) {
        const item = line.match(/^([\w-]+)\s*=\s*("(?:\\.|[^"\\])*")\s*$/);
        if (item) cursor[item[1]] = JSON.parse(item[2]);
      }
    }
    tomlCache = root;
  }
  const result: Dictionary = {};
  const collect = (src: Dictionary, dst: Dictionary) => Object.entries(src).forEach(([key, value]) => {
    if (value && typeof value === "object") {
      const map = value as Record<string, unknown>;
      const isTranslationTable = Object.keys(map).length > 0 && Object.values(map).every((entry) => typeof entry === "string");
      if (isTranslationTable) dst[key] = map[locale] ?? map.en;
      else { const child: Dictionary = {}; collect(map as Dictionary, child); dst[key] = child; }
    }
  });
  collect(tomlCache, result);
  return result;
}

async function loadDictionary(locale: string): Promise<Dictionary> {
  const targetLocale = locale || "en";

  if (Object.keys(state.fallbackDictionary).length === 0) {
    if (targetLocale === "en") {
      state.fallbackDictionary = await fetchLangJson("en");
      state.dictionary = state.fallbackDictionary;
      state.locale = "en";
      return state.dictionary;
    } else {
      try {
        state.fallbackDictionary = await fetchLangJson("en");
      } catch (err) {
        console.warn("Failed to load fallback dictionary (en):", err);
      }
    }
  }

  if (targetLocale === "en") {
    state.dictionary = state.fallbackDictionary;
  } else {
    state.dictionary = await fetchLangJson(targetLocale);
  }
  state.locale = targetLocale;
  return state.dictionary;
}

function normalizeLocale(locale: string = "en"): string {
  const normalized = String(locale || "en").trim().toLowerCase();
  // =====================
  // ADD NRW ALIASES HERE!
  // =====================
  const aliases: Record<string, string> = {
    en: "en",
    english: "en",
    anglais: "en",
    fr: "fr",
    french: "fr",
    francais: "fr",
    français: "fr",
    pl: "pl",
    polish: "pl",
    polski: "pl",
  };
  // =====================

  return aliases[normalized] || (normalized.length === 2 ? normalized : "en");
}

export async function initI18n(locale: string = "en"): Promise<Dictionary> {
  const normalized = normalizeLocale(locale);

  if (state.locale === normalized && Object.keys(state.dictionary).length > 0) {
    return state.dictionary;
  }

  if (!state.initPromise) {
    state.initPromise = loadDictionary(normalized)
      .then((dict) => {
        notifyListeners();
        return dict;
      })
      .finally(() => {
        state.initPromise = null;
      });
  }
  return state.initPromise;
}

export function t(
  key: string,
  fallbackOrParams?: string | Record<string, unknown> | null,
  params?: Record<string, unknown> | null
): string {
  let fallbackStr = "";
  let actualParams: Record<string, unknown> | null = null;

  if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
    actualParams = fallbackOrParams;
  } else if (typeof fallbackOrParams === "string") {
    fallbackStr = fallbackOrParams;
    actualParams = params || null;
  }

  let resolved = resolveKey(state.dictionary, key);
  if (resolved === undefined && state.fallbackDictionary) {
    resolved = resolveKey(state.fallbackDictionary, key);
  }

  const base = typeof resolved === "string" ? resolved : (fallbackStr || key);
  return interpolate(base, actualParams);
}

export function getLocale(): string {
  return state.locale;
}

export function getLanguages(): { value: string; label: string }[] {
  const names = tomlCache?.language as Record<string, unknown> | undefined;
  const entries = names?.name as Record<string, unknown> | undefined;
  return Object.entries(entries || {}).map(([value, label]) => ({ value, label: String(label) }));
}

export function useTranslation() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    t,
    locale: state.locale,
    changeLanguage: async (newLocale: string) => {
      await initI18n(newLocale);
    },
  };
}