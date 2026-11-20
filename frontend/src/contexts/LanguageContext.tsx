import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, languageNames, type LanguageCode } from "../locales";
import { en } from "../locales/en";

type TranslationKey = keyof typeof en;

interface LanguageContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  localize: (item: any, fieldBaseName: string) => string;
  availableLanguages: typeof languageNames;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("app_lang") as LanguageCode | null;
    if (saved && dictionaries[saved]) return saved;
    // Default to traditional chinese or english based on browser language
    return navigator.language.startsWith("zh") ? "zh-TW" : "en";
  });

  useEffect(() => {
    localStorage.setItem("app_lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(newLang: LanguageCode) {
    if (dictionaries[newLang]) {
      setLangState(newLang);
    }
  }

  function toggleLang() {
    setLangState((prev) => (prev === "en" ? "zh-TW" : "en"));
  }

  // Translation function for UI labels
  function t(key: TranslationKey): string {
    const dict = dictionaries[lang] || dictionaries.en;
    return dict[key] || dictionaries.en[key] || String(key);
  }

  // Helper to pick database content based on active language
  // e.g. localize(book, 'title') picks book.title_zh when lang === 'zh-TW', else book.title_en
  function localize(item: any, fieldBaseName: string): string {
    if (!item) return "";
    const suffix = lang === "zh-TW" ? "_zh" : "_en";
    const localized = item[`${fieldBaseName}${suffix}`];
    if (localized !== undefined && localized !== null && localized !== "") {
      return String(localized);
    }
    // Fallback to the other language or plain field
    const fallbackSuffix = lang === "zh-TW" ? "_en" : "_zh";
    return String(item[`${fieldBaseName}${fallbackSuffix}`] || item[fieldBaseName] || "");
  }

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        localize,
        availableLanguages: languageNames,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
