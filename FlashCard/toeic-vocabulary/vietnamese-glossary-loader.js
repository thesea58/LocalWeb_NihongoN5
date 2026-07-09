(() => {
  "use strict";

  if (typeof window.fetch !== "function") {
    return;
  }

  const VOCABULARY_FILE = "toeic_tsl_1_500_vocabularies_with_readings.json";
  const GLOSSARY_URL = "../data/Eng-Ja-Vi/toeic_vietnamese_english_glossary.json";
  const nativeFetch = window.fetch.bind(window);
  let glossaryPromise = null;

  function getRequestUrl(input) {
    if (typeof input === "string" || input instanceof URL) {
      return String(input);
    }

    return input?.url || "";
  }

  function isToeicVocabularyRequest(input) {
    try {
      const url = new URL(getRequestUrl(input), window.location.href);
      return url.pathname.endsWith(`/${VOCABULARY_FILE}`);
    } catch (error) {
      console.warn("Không thể kiểm tra URL dữ liệu TOEIC:", error);
      return false;
    }
  }

  async function loadGlossary() {
    if (!glossaryPromise) {
      glossaryPromise = nativeFetch(GLOSSARY_URL, { cache: "no-store" })
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
          console.warn("Sử dụng nghĩa tiếng Việt gốc vì glossary không tải được:", error);
          return null;
        });
    }

    return glossaryPromise;
  }

  function applyGlossary(payload, translations) {
    if (!payload || !Array.isArray(payload.vocabularies) || !translations) {
      return payload;
    }

    let appliedCount = 0;

    const vocabularies = payload.vocabularies.map((word) => {
      const rank = String(word?.rank ?? word?.id ?? "");
      const reviewedMeaning = translations[rank];

      if (typeof reviewedMeaning !== "string" || !reviewedMeaning.trim()) {
        return word;
      }

      appliedCount += 1;
      return {
        ...word,
        vietnamese: reviewedMeaning.trim(),
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
        loaded_at: new Date().toISOString(),
      },
    };
  }

  function createMergedResponse(response, payload) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("content-type", "application/json; charset=utf-8");

    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  window.fetch = async function fetchWithEnglishBasedVietnamese(input, init) {
    const response = await nativeFetch(input, init);

    if (!response.ok || !isToeicVocabularyRequest(input)) {
      return response;
    }

    try {
      const [payload, translations] = await Promise.all([
        response.clone().json(),
        loadGlossary(),
      ]);

      if (!translations) {
        return response;
      }

      return createMergedResponse(response, applyGlossary(payload, translations));
    } catch (error) {
      console.warn("Không thể áp dụng glossary tiếng Việt theo tiếng Anh:", error);
      return response;
    }
  };
})();
