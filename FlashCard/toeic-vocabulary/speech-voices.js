(() => {
  "use strict";

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return;
  }

  const synthesis = window.speechSynthesis;
  let availableVoices = [];
  let lastEnglishAccent = "";

  const englishAccents = [
    { language: "en-US", label: "Mỹ" },
    { language: "en-GB", label: "Anh" },
    { language: "en-CA", label: "Canada" },
    { language: "en-AU", label: "Úc" },
  ];

  const languageSettings = {
    "ja-JP": {
      languagePrefix: "ja",
      rate: 0.82,
      preferredNames: [
        "Google 日本語",
        "Microsoft Nanami",
        "Microsoft Haruka",
        "Microsoft Ayumi",
        "Kyoko",
        "Otoya",
        "Mizuki",
        "Takumi",
      ],
    },
    "en-US": {
      languagePrefix: "en",
      rate: 0.9,
      preferredNames: [
        "Google US English",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Guy",
        "Samantha",
        "Alex",
        "Zira",
        "David",
      ],
    },
    "en-GB": {
      languagePrefix: "en",
      rate: 0.9,
      preferredNames: [
        "Google UK English",
        "Microsoft Sonia",
        "Microsoft Ryan",
        "Daniel",
        "Serena",
        "Kate",
      ],
    },
    "en-CA": {
      languagePrefix: "en",
      rate: 0.9,
      preferredNames: [
        "Microsoft Clara",
        "Microsoft Liam",
        "Canada",
        "Canadian",
      ],
    },
    "en-AU": {
      languagePrefix: "en",
      rate: 0.9,
      preferredNames: [
        "Google Australian English",
        "Microsoft Natasha",
        "Microsoft William",
        "Karen",
        "Lee",
        "Australia",
        "Australian",
      ],
    },
    "vi-VN": {
      languagePrefix: "vi",
      rate: 0.88,
      preferredNames: [
        "Google Tiếng Việt",
        "Microsoft HoaiMy",
        "Microsoft NamMinh",
        "HoaiMy",
        "NamMinh",
        "Linh",
        "An",
      ],
    },
  };

  function normalizeLanguage(language) {
    return String(language || "")
      .replace("_", "-")
      .toLowerCase();
  }

  function refreshVoices() {
    availableVoices = synthesis.getVoices();
  }

  function randomItem(items) {
    if (!items.length) {
      return null;
    }

    return items[Math.floor(Math.random() * items.length)];
  }

  function getVoiceScore(voice, targetLanguage, settings) {
    const voiceLanguage = normalizeLanguage(voice.lang);
    const normalizedTarget = normalizeLanguage(targetLanguage);
    const voiceName = voice.name.toLowerCase();

    let score = 0;

    if (voiceLanguage === normalizedTarget) {
      score += 100;
    } else if (voiceLanguage.startsWith(`${settings.languagePrefix}-`)) {
      score += 60;
    } else if (voiceLanguage === settings.languagePrefix) {
      score += 50;
    } else {
      return -1;
    }

    settings.preferredNames.forEach((preferredName, index) => {
      if (voiceName.includes(preferredName.toLowerCase())) {
        score += 40 - index;
      }
    });

    if (voice.default) {
      score += 2;
    }

    return score;
  }

  function findBestVoice(targetLanguage) {
    const settings = languageSettings[targetLanguage];
    if (!settings) {
      return null;
    }

    if (!availableVoices.length) {
      refreshVoices();
    }

    return availableVoices
      .map((voice) => ({
        voice,
        score: getVoiceScore(voice, targetLanguage, settings),
      }))
      .filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score)[0]?.voice || null;
  }

  function getEnglishAccentBuckets() {
    if (!availableVoices.length) {
      refreshVoices();
    }

    return englishAccents
      .map((accent) => ({
        ...accent,
        voices: availableVoices.filter(
          (voice) => normalizeLanguage(voice.lang) === normalizeLanguage(accent.language),
        ),
      }))
      .filter((accent) => accent.voices.length > 0);
  }

  function chooseRandomEnglishVoice() {
    const accentBuckets = getEnglishAccentBuckets();

    if (accentBuckets.length > 0) {
      const differentAccents = accentBuckets.filter(
        (accent) => accent.language !== lastEnglishAccent,
      );
      const selectableAccents = differentAccents.length > 0
        ? differentAccents
        : accentBuckets;
      const selectedAccent = randomItem(selectableAccents);
      const selectedVoice = randomItem(selectedAccent.voices);

      lastEnglishAccent = selectedAccent.language;

      return {
        voice: selectedVoice,
        language: selectedVoice.lang || selectedAccent.language,
        accentLabel: selectedAccent.label,
      };
    }

    const fallbackEnglishVoices = availableVoices.filter((voice) =>
      normalizeLanguage(voice.lang).startsWith("en"),
    );
    const fallbackVoice = randomItem(fallbackEnglishVoices);

    return {
      voice: fallbackVoice,
      language: fallbackVoice?.lang || "en-US",
      accentLabel: "English",
    };
  }

  function createUtterance(text, language) {
    const content = String(text || "").trim();
    if (!content) {
      return null;
    }

    const normalizedLanguage = normalizeLanguage(language);
    const isEnglish = normalizedLanguage.startsWith("en");
    const targetLanguage = languageSettings[language]
      ? language
      : isEnglish
        ? "en-US"
        : "en-US";
    const settings = languageSettings[targetLanguage];
    const utterance = new SpeechSynthesisUtterance(content);
    const englishSelection = isEnglish ? chooseRandomEnglishVoice() : null;
    const selectedVoice = englishSelection?.voice || findBestVoice(targetLanguage);

    utterance.lang = englishSelection?.language || targetLanguage;
    utterance.rate = settings.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || utterance.lang;
    }

    if (isEnglish) {
      utterance.toeicAccent = englishSelection?.accentLabel || "English";
      document.dispatchEvent(
        new CustomEvent("toeic:english-accent-selected", {
          detail: {
            accent: utterance.toeicAccent,
            language: utterance.lang,
            voiceName: selectedVoice?.name || "Giọng mặc định",
          },
        }),
      );
    }

    return utterance;
  }

  window.speak = function speakWithMatchingVoice(text, language) {
    const utterance = createUtterance(text, language);
    if (!utterance) {
      return null;
    }

    synthesis.cancel();

    utterance.onerror = (event) => {
      if (event.error !== "interrupted" && event.error !== "canceled") {
        console.warn("Không thể phát âm:", event.error);
      }
    };

    synthesis.speak(utterance);
    return utterance;
  };

  window.speakAsync = function speakWithMatchingVoiceAsync(text, language) {
    const utterance = createUtterance(text, language);
    if (!utterance) {
      return Promise.resolve(false);
    }

    synthesis.cancel();

    return new Promise((resolve) => {
      let settled = false;
      const safetyTimeout = Math.min(30000, Math.max(8000, utterance.text.length * 450));
      const timeoutId = window.setTimeout(() => finish(false), safetyTimeout);

      function finish(completed) {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        resolve(completed);
      }

      utterance.onend = () => finish(true);
      utterance.onerror = (event) => {
        if (event.error !== "interrupted" && event.error !== "canceled") {
          console.warn("Không thể phát âm:", event.error);
        }
        finish(false);
      };

      synthesis.speak(utterance);
    });
  };

  window.getToeicEnglishAccents = function getToeicEnglishAccents() {
    return getEnglishAccentBuckets().map((accent) => ({
      language: accent.language,
      label: accent.label,
      voiceCount: accent.voices.length,
    }));
  };

  refreshVoices();
  synthesis.addEventListener("voiceschanged", refreshVoices);
})();
