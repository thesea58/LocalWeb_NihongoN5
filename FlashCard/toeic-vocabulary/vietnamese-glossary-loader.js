(() => {
  "use strict";

  const GLOSSARY_URL = "../data/Eng-Ja-Vi/toeic_vietnamese_english_glossary.json";
  let glossaryPromise = null;

  async function loadGlossary() {
    if (!glossaryPromise) {
      glossaryPromise = fetch(GLOSSARY_URL, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Không tải được glossary tiếng Việt (${response.status}).`);
          }
          return response.json();
        })
        .then((payload) => {
          if (!payload || typeof payload.translations !== "object") {
            throw new Error("Glossary tiếng Việt không đúng cấu trúc.");
          }
          return payload.translations;
        })
        .catch((error) => {
          glossaryPromise = null;
          console.warn("Sử dụng nghĩa tiếng Việt gốc:", error);
          return null;
        });
    }

    return glossaryPromise;
  }

  async function applyEnglishReviewedVietnamese(payload) {
    const translations = await loadGlossary();
    if (!payload || !Array.isArray(payload.vocabularies) || !translations) {
      return payload;
    }

    let appliedCount = 0;
    const vocabularies = payload.vocabularies.map((word) => {
      const rank = String(word?.rank ?? word?.id ?? "");
      const translated = translations[rank];
      if (typeof translated !== "string" || !translated.trim()) return word;

      appliedCount += 1;
      return {
        ...word,
        vietnamese: translated.trim(),
        translation_review: "english-reviewed",
        vietnamese_translation_source: "english-headword-and-toeic-context",
      };
    });

    return {
      ...payload,
      vocabularies,
      vietnamese_glossary: {
        source_language: "English",
        applied_count: appliedCount,
      },
    };
  }

  window.toeicVietnameseGlossary = { applyEnglishReviewedVietnamese };
})();
