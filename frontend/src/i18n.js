// src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Importez vos fichiers de traduction
import translationFR from "./locales/fr.json";
import translationEN from "./locales/en.json";

const resources = {
  fr: { translation: translationFR },
  en: { translation: translationEN },
};

i18n.use(initReactI18next).init({
  resources,
  fallbackLng: "fr",
  supportedLngs: ["fr", "en"],
  interpolation: {
    escapeValue: false, // React s'en charge
  },
});

export default i18n;
