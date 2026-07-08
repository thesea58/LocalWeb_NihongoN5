(() => {
  "use strict";

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    return;
  }

  const synthesis = window.speechSynthesis;
  let availableVoices = [];

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

  function createUtterance(text, language) {
    const content = String(text || "").trim();
    if (!content) {
      return null;
    }

    const targetLanguage = languageSettings[language] ? language : "en-US";
    const settings = languageSettings[targetLanguage];
    const utterance = new SpeechSynthesisUtterance(content);
    const selectedVoice = findBestVoice(targetLanguage);

    utterance.lang = targetLanguage;
    utterance.rate = settings.rate;
    utterance.pitch = 1;
    utterance.volume = 1;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || targetLanguage;
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

  refreshVoices();
  synthesis.addEventListener("voiceschanged", refreshVoices);
})();
