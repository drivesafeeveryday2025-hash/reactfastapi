import { en } from "./en";
import { zhTW } from "./zhTW";

export type LanguageCode = "en" | "zh-TW";

export const dictionaries: Record<LanguageCode, typeof en> = {
  en,
  "zh-TW": zhTW,
};

export const languageNames: Record<LanguageCode, string> = {
  en: "English",
  "zh-TW": "繁體中文",
};
