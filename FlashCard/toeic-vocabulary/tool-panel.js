(() => {
  "use strict";

  const randomButton = document.getElementById("randomButton");
  const cardHost = document.getElementById("cardHost");

  if (!randomButton || !cardHost) {
    return;
  }

  const REPEAT_COUNT = 3;
  const REPEAT_INTERVAL_MS = 3000;
  const WORD_CHANGE_DELAY_MS = 450;

  let autoPlaying = false;
  let timerId = null;
  let runToken = 0;

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
            <p class="tool-mode__description">Chọn từ ngẫu nhiên, đọc tiếng Anh 3 lần, mỗi lần cách nhau 3 giây.</p>
          </div>

          <label class="tool-switch" aria-label="Bật hoặc tắt Auto Play">
            <input id="autoPlayToggle" type="checkbox" />
            <span class="tool-switch__track" aria-hidden="true"></span>
          </label>
        </div>

        <div id="toolStatus" class="tool-status">
          <span class="tool-status__dot" aria-hidden="true"></span>
          <span id="toolStatusText">Auto Play đang tắt.</span>
        </div>

        <div id="toolRepeatProgress" class="tool-repeat-progress" aria-label="Tiến độ số lần đọc">
          <span></span><span></span><span></span>
        </div>

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
  const progressItems = [...document.querySelectorAll("#toolRepeatProgress span")];

  function setPanelOpen(open) {
    panel.hidden = !open;
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Đóng bảng công cụ" : "Mở bảng công cụ");
  }

  function updateRepeatProgress(repeatNumber = 0) {
    progressItems.forEach((item, index) => {
      item.classList.toggle("is-done", index < repeatNumber);
    });
  }

  function updateRunningState(running) {
    toggle.checked = running;
    bubble.classList.toggle("is-active", running);
    status.classList.toggle("is-running", running);
    stopButton.hidden = !running;

    if (!running) {
      statusText.textContent = "Auto Play đang tắt.";
      updateRepeatProgress(0);
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

  function stopAutoPlay() {
    autoPlaying = false;
    runToken += 1;
    clearScheduledAction();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    updateRunningState(false);
  }

  function readEnglishWord(word, repeatNumber, token) {
    if (!autoPlaying || token !== runToken) {
      return;
    }

    updateRepeatProgress(repeatNumber);
    statusText.textContent = `Đang đọc ${repeatNumber}/${REPEAT_COUNT}: ${word}`;

    if (typeof window.speak === "function") {
      window.speak(word, "en-US");
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    if (repeatNumber < REPEAT_COUNT) {
      schedule(
        () => readEnglishWord(word, repeatNumber + 1, token),
        REPEAT_INTERVAL_MS,
        token,
      );
      return;
    }

    statusText.textContent = `Đã đọc 3 lần: ${word}. Chuẩn bị từ tiếp theo...`;
    schedule(() => playNextRandomWord(token), REPEAT_INTERVAL_MS, token);
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

    updateRepeatProgress(0);
    statusText.textContent = "Đang chọn từ ngẫu nhiên...";
    randomButton.click();

    schedule(() => {
      const englishWord = document.getElementById("englishWord")?.textContent.trim();

      if (!englishWord) {
        statusText.textContent = "Chưa lấy được từ tiếng Anh. Đang thử lại...";
        schedule(() => playNextRandomWord(token), 700, token);
        return;
      }

      readEnglishWord(englishWord, 1, token);
    }, WORD_CHANGE_DELAY_MS, token);
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

  stopButton.addEventListener("click", stopAutoPlay);

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

  updateRunningState(false);
})();
