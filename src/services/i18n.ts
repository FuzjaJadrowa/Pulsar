import { useState, useEffect } from "react";

type Dictionary = Record<string, any>;

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

function resolveKey(obj: any, key: string): any {
  if (!obj || !key) return undefined;
  return key.split(".").reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, obj);
}

function interpolate(template: any, params: Record<string, any> | null): string {
  if (typeof template !== "string") return template || "";
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    if (params && Object.prototype.hasOwnProperty.call(params, token)) {
      return String(params[token]);
    }
    return `{${token}}`;
  });
}

async function fetchLangJson(locale: string): Promise<Dictionary> {
  const response = await fetch(`./assets/langs/${locale}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load language file (${locale}): ${response.status}`);
  }
  const json = await response.json();
  return json && typeof json === "object" ? json : {};
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

  return aliases[normalized] || "en";
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
  fallbackOrParams?: string | Record<string, any> | null,
  params?: Record<string, any> | null
): string {
  let fallbackStr = "";
  let actualParams: Record<string, any> | null = null;

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