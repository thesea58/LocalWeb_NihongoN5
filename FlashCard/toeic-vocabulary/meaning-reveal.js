(() => {
  "use strict";

  const panel = document.getElementById("toolPanel");
  const cardHost = document.getElementById("cardHost");

  if (!panel || !cardHost) {
    return;
  }

  const STORAGE_KEY = "toeic-delay-vietnamese-meaning";
  const settingsStore = window.toeicStorage?.local;
  let enabled = settingsStore?.get(STORAGE_KEY, false) === true;

  panel.insertAdjacentHTML(
    "beforeend",
    `
      <div class="tool-mode meaning-reveal-mode">
        <div class="tool-mode__row">
          <div>
            <p class="tool-mode__name">Đoán nghĩa tiếng Việt</p>
            <p class="tool-mode__description">Ẩn nghĩa khi đổi từ và hiện dần hoàn tất trong 2 giây.</p>
          </div>

          <label class="tool-switch" aria-label="Bật hoặc tắt chế độ đoán nghĩa tiếng Việt">
            <input id="meaningRevealToggle" type="checkbox" />
            <span class="tool-switch__track" aria-hidden="true"></span>
          </label>
        </div>

        <div id="meaningRevealStatus" class="tool-status">
          <span class="tool-status__dot" aria-hidden="true"></span>
          <span id="meaningRevealStatusText"></span>
        </div>
      </div>
    `,
  );

  const toggle = document.getElementById("meaningRevealToggle");
  const status = document.getElementById("meaningRevealStatus");
  const statusText = document.getElementById("meaningRevealStatusText");

  function savePreference() {
    settingsStore?.set(STORAGE_KEY, enabled);
  }

  function updateStatus() {
    status.classList.toggle("is-running", enabled);
    statusText.textContent = enabled
      ? "Nghĩa tiếng Việt sẽ hiện dần trong 2 giây sau mỗi lần đổi từ."
      : "Nghĩa tiếng Việt đang hiển thị ngay.";
  }

  function restartRevealAnimation() {
    const meaning = cardHost.querySelector("#vietnameseWord");
    if (!meaning) {
      return;
    }

    meaning.classList.remove("vietnamese-delayed-reveal");

    if (!enabled) {
      return;
    }

    void meaning.offsetWidth;
    meaning.classList.add("vietnamese-delayed-reveal");
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    toggle.checked = enabled;
    savePreference();
    updateStatus();
    restartRevealAnimation();
  }

  const observer = new MutationObserver(() => {
    restartRevealAnimation();
  });

  observer.observe(cardHost, {
    childList: true,
    subtree: true,
  });

  toggle.addEventListener("change", () => {
    setEnabled(toggle.checked);
  });

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
  });

  toggle.checked = enabled;
  updateStatus();
  restartRevealAnimation();
})();
