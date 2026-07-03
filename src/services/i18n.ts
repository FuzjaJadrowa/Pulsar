import { useState, useEffect } from "react";

type Dictionary = Record<string, any>;

interface I18nState {
  locale: string;
  dictionary: Dictionary;
  initPromise: Promise<Dictionary> | null;
}

const state: I18nState = {
  locale: "en",
  dictionary: {},
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

async function loadDictionary(locale: string): Promise<Dictionary> {
  const targetLocale = locale || "en";
  // Fetch from the public assets path
  const response = await fetch(`./assets/langs/${targetLocale}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load language file: ${response.status}`);
  }
  const json = await response.json();
  state.locale = targetLocale;
  state.dictionary = json && typeof json === "object" ? json : {};
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

export function t(key: string, fallback: string = "", params: Record<string, any> | null = null): string {
  const resolved = resolveKey(state.dictionary, key);
  const base = typeof resolved === "string" ? resolved : (fallback || key);
  return interpolate(base, params);
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