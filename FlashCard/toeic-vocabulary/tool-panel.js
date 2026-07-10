(() => {
  "use strict";

  const randomButton = document.getElementById("randomButton");
  const cardHost = document.getElementById("cardHost");

  if (!randomButton || !cardHost) {
    return;
  }

  const WORD_CHANGE_DELAY_MS = 450;
  const SETTINGS_KEY = "toeic-auto-play-settings";
  const settingsStore = window.toeicStorage?.local;
  const DEFAULT_SETTINGS = {
    repeatCount: 3,
    intervalSeconds: 3,
  };

  let autoPlaying = false;
  let timerId = null;
  let runToken = 0;

  function loadSettings() {
    try {
      const stored = settingsStore?.get(SETTINGS_KEY, null);
      const repeatCount = Number(stored?.repeatCount);
      const intervalSeconds = Number(stored?.intervalSeconds);

      return {
        repeatCount: [1, 2, 3, 4, 5].includes(repeatCount)
          ? repeatCount
          : DEFAULT_SETTINGS.repeatCount,
        intervalSeconds: [1, 2, 3, 5, 8].includes(intervalSeconds)
          ? intervalSeconds
          : DEFAULT_SETTINGS.intervalSeconds,
      };
    } catch (error) {
      console.warn("Không thể tải thiết lập Auto Play:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  const settings = loadSettings();

  const dock = document.createElement("div");
  dock.className = "tool-dock";
  dock.innerHTML = `
    <button
      id="toolBubble"
      class="tool-bubble"
      type="button"
      aria-label="Mở bảng công cụ"
      aria-expanded="false"
      aria-controls="toolPanel"
      title="Công cụ học tập"
    >⚙</button>

    <section id="toolPanel" class="tool-panel" aria-label="Bảng công cụ" hidden>
      <div class="tool-panel__header">
        <div>
          <p class="tool-panel__eyebrow">Study tools</p>
          <h2 class="tool-panel__title">Bảng công cụ</h2>
        </div>
        <button id="toolPanelClose" class="tool-panel__close" type="button" aria-label="Đóng bảng công cụ">✕</button>
      </div>

      <div class="tool-mode">
        <div class="tool-mode__row">
          <div>
            <p class="tool-mode__name">Auto Play</p>
            <p id="autoPlayDescription" class="tool-mode__description"></p>
          </div>

          <label class="tool-switch" aria-label="Bật hoặc tắt Auto Play">
            <input id="autoPlayToggle" type="checkbox" />
            <span class="tool-switch__track" aria-hidden="true"></span>
          </label>
        </div>

        <div class="tool-settings" aria-label="Thiết lập Auto Play">
          <label class="tool-setting">
            <span>Số lượt Anh–Việt</span>
            <select id="repeatCountSelect" aria-label="Số lượt đọc Anh và Việt cho mỗi từ">
              <option value="1">1 lượt</option>
              <option value="2">2 lượt</option>
              <option value="3">3 lượt</option>
              <option value="4">4 lượt</option>
              <option value="5">5 lượt</option>
            </select>
          </label>

          <label class="tool-setting">
            <span>Thời gian chờ</span>
            <select id="repeatIntervalSelect" aria-label="Thời gian chờ sau khi đọc xong">
              <option value="1">1 giây</option>
              <option value="2">2 giây</option>
              <option value="3">3 giây</option>
              <option value="5">5 giây</option>
              <option value="8">8 giây</option>
            </select>
          </label>
        </div>

        <div id="toolStatus" class="tool-status">
          <span class="tool-status__dot" aria-hidden="true"></span>
          <span id="toolStatusText">Auto Play đang tắt.</span>
        </div>

        <div id="toolRepeatProgress" class="tool-repeat-progress" aria-label="Tiến độ số lượt Anh–Việt"></div>

        <button id="toolStopButton" class="tool-stop-button" type="button" hidden>Dừng Auto Play</button>
      </div>
    </section>
  `;

  document.body.append(dock);

  const bubble = document.getElementById("toolBubble");
  const panel = document.getElementById("toolPanel");
  const closeButton = document.getElementById("toolPanelClose");
  const toggle = document.getElementById("autoPlayToggle");
  const stopButton = document.getElementById("toolStopButton");
  const status = document.getElementById("toolStatus");
  const statusText = document.getElementById("toolStatusText");
  const description = document.getElementById("autoPlayDescription");
  const progress = document.getElementById("toolRepeatProgress");
  const repeatCountSelect = document.getElementById("repeatCountSelect");
  const repeatIntervalSelect = document.getElementById("repeatIntervalSelect");

  repeatCountSelect.value = String(settings.repeatCount);
  repeatIntervalSelect.value = String(settings.intervalSeconds);

  function getRepeatCount() {
    return Number(repeatCountSelect.value) || DEFAULT_SETTINGS.repeatCount;
  }

  function getIntervalSeconds() {
    return Number(repeatIntervalSelect.value) || DEFAULT_SETTINGS.intervalSeconds;
  }

  function getIntervalMilliseconds() {
    return getIntervalSeconds() * 1000;
  }

  function saveSettings() {
    settingsStore?.set(SETTINGS_KEY, {
      repeatCount: getRepeatCount(),
      intervalSeconds: getIntervalSeconds(),
    });
  }

  function updateDescription() {
    const repeatCount = getRepeatCount();
    const intervalSeconds = getIntervalSeconds();
    description.textContent = `Đọc xen kẽ English → Tiếng Việt ${repeatCount} lượt. Sau khi đọc xong mới chờ ${intervalSeconds} giây.`;
  }

  function renderRepeatProgress(completedCount = 0) {
    const repeatCount = getRepeatCount();
    progress.innerHTML = Array.from(
      { length: repeatCount },
      (_, index) => `<span class="${index < completedCount ? "is-done" : ""}"></span>`,
    ).join("");
    progress.setAttribute(
      "aria-label",
      `Đã hoàn thành ${completedCount} trên ${repeatCount} lượt Anh–Việt`,
    );
  }

  function setPanelOpen(open) {
    panel.hidden = !open;
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Đóng bảng công cụ" : "Mở bảng công cụ");
  }

  function updateRunningState(running) {
    toggle.checked = running;
    bubble.classList.toggle("is-active", running);
    status.classList.toggle("is-running", running);
    stopButton.hidden = !running;

    if (!running) {
      statusText.textContent = "Auto Play đang tắt.";
      renderRepeatProgress(0);
    }
  }

  function clearScheduledAction() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  function schedule(callback, delay, token) {
    clearScheduledAction();
    timerId = window.setTimeout(() => {
      timerId = null;
      if (!autoPlaying || token !== runToken) {
        return;
      }
      callback();
    }, delay);
  }

  function stopCurrentSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function speakText(text, language) {
    if (typeof window.speakAsync === "function") {
      return window.speakAsync(text, language);
    }

    if (!("speechSynthesis" in window)) {
      return false;
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = language === "vi-VN" ? 0.88 : 0.9;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  function stopAutoPlay() {
    autoPlaying = false;
    runToken += 1;
    clearScheduledAction();
    stopCurrentSpeech();
    updateRunningState(false);
  }

  async function readVietnameseWord(words, repeatNumber, token) {
    if (!autoPlaying || token !== runToken) {
      return;
    }

    const repeatCount = getRepeatCount();
    statusText.textContent = `Lượt ${repeatNumber}/${repeatCount} · Tiếng Việt: ${words.vietnamese}`;
    await speakText(words.vietnamese, "vi-VN");

    if (!autoPlaying || token !== runToken) {
      return;
    }

    renderRepeatProgress(repeatNumber);

    if (repeatNumber < repeatCount) {
      statusText.textContent = `Đã đọc xong tiếng Việt. Chờ ${getIntervalSeconds()} giây...`;
      schedule(
        () => readEnglishWord(words, repeatNumber + 1, token),
        getIntervalMilliseconds(),
        token,
      );
      return;
    }

    statusText.textContent = `Đã hoàn thành ${repeatCount} lượt Anh–Việt. Chờ ${getIntervalSeconds()} giây để sang từ tiếp theo...`;
    schedule(() => playNextRandomWord(token), getIntervalMilliseconds(), token);
  }

  async function readEnglishWord(words, repeatNumber, token) {
    if (!autoPlaying || token !== runToken) {
      return;
    }

    const repeatCount = getRepeatCount();
    renderRepeatProgress(repeatNumber - 1);
    statusText.textContent = `Lượt ${repeatNumber}/${repeatCount} · English: ${words.english}`;
    await speakText(words.english, "en-US");

    if (!autoPlaying || token !== runToken) {
      return;
    }

    statusText.textContent = `Đã đọc xong tiếng Anh. Chờ ${getIntervalSeconds()} giây...`;
    schedule(
      () => readVietnameseWord(words, repeatNumber, token),
      getIntervalMilliseconds(),
      token,
    );
  }

  function readCurrentDisplayedWord(token) {
    if (!autoPlaying || token !== runToken) {
      return;
    }

    const englishWord = document.getElementById("englishWord")?.textContent.trim();
    const vietnameseWord = document.getElementById("vietnameseWord")?.textContent.trim();

    if (!englishWord || !vietnameseWord) {
      statusText.textContent = "Đang chờ từ vừa chuyển tới...";
      schedule(() => readCurrentDisplayedWord(token), 180, token);
      return;
    }

    readEnglishWord(
      {
        english: englishWord,
        vietnamese: vietnameseWord,
      },
      1,
      token,
    );
  }

  function playNextRandomWord(token) {
    if (!autoPlaying || token !== runToken) {
      return;
    }

    if (randomButton.disabled) {
      statusText.textContent = "Đang chờ dữ liệu từ vựng...";
      schedule(() => playNextRandomWord(token), 500, token);
      return;
    }

    renderRepeatProgress(0);
    statusText.textContent = "Đang chọn từ ngẫu nhiên...";
    if (typeof window.toeicVocabularyApp?.showRandomWord === "function") {
      window.toeicVocabularyApp.showRandomWord("autoplay");
    } else {
      randomButton.click();
    }
    schedule(() => readCurrentDisplayedWord(token), WORD_CHANGE_DELAY_MS, token);
  }

  function continueAutoPlayFromManualWordChange(event) {
    if (!autoPlaying || event.detail?.source === "autoplay") {
      return;
    }

    runToken += 1;
    const token = runToken;
    clearScheduledAction();
    stopCurrentSpeech();
    renderRepeatProgress(0);
    statusText.textContent = "Đã chuyển từ thủ công. Đang đọc từ mới...";
    schedule(() => readCurrentDisplayedWord(token), WORD_CHANGE_DELAY_MS, token);
  }

  function startAutoPlay() {
    if (autoPlaying) {
      return;
    }

    autoPlaying = true;
    runToken += 1;
    const token = runToken;

    updateRunningState(true);
    setPanelOpen(true);
    statusText.textContent = "Auto Play đang khởi động...";
    playNextRandomWord(token);
  }

  function handleSettingsChange() {
    saveSettings();
    updateDescription();
    renderRepeatProgress(0);

    if (autoPlaying) {
      statusText.textContent = "Thiết lập mới sẽ áp dụng ngay từ lượt tiếp theo.";
    }
  }

  bubble.addEventListener("click", () => {
    setPanelOpen(panel.hidden);
  });

  closeButton.addEventListener("click", () => {
    setPanelOpen(false);
  });

  toggle.addEventListener("change", () => {
    if (toggle.checked) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }
  });

  repeatCountSelect.addEventListener("change", handleSettingsChange);
  repeatIntervalSelect.addEventListener("change", handleSettingsChange);
  stopButton.addEventListener("click", stopAutoPlay);
  document.addEventListener("toeic:word-change", continueAutoPlayFromManualWordChange);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setPanelOpen(false);
      bubble.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !dock.contains(event.target)) {
      setPanelOpen(false);
    }
  });

  window.addEventListener("beforeunload", stopAutoPlay);

  updateDescription();
  renderRepeatProgress(0);
  updateRunningState(false);
})();
