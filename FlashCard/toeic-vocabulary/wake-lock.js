(() => {
  "use strict";

  const panel = document.getElementById("toolPanel");
  const firstMode = panel?.querySelector(".tool-mode");

  if (!panel || !firstMode) {
    return;
  }

  const STORAGE_KEY = "toeic-keep-screen-awake";
  const settingsStore = window.toeicStorage?.local;
  let enabled = settingsStore?.get(STORAGE_KEY, false) === true;
  let wakeLock = null;
  let requesting = false;

  firstMode.insertAdjacentHTML(
    "afterend",
    `
      <div class="tool-mode wake-lock-mode">
        <div class="tool-mode__row">
          <div>
            <p class="tool-mode__name">Giữ màn hình sáng</p>
            <p class="tool-mode__description">Ngăn điện thoại tự tắt màn hình khi đang học trên trang này.</p>
          </div>

          <label class="tool-switch" aria-label="Bật hoặc tắt giữ màn hình sáng">
            <input id="wakeLockToggle" type="checkbox" />
            <span class="tool-switch__track" aria-hidden="true"></span>
          </label>
        </div>

        <div id="wakeLockStatus" class="tool-status">
          <span class="tool-status__dot" aria-hidden="true"></span>
          <span id="wakeLockStatusText">Đang chuẩn bị...</span>
        </div>
      </div>
    `,
  );

  const toggle = document.getElementById("wakeLockToggle");
  const status = document.getElementById("wakeLockStatus");
  const statusText = document.getElementById("wakeLockStatusText");

  function setStatus(message, state = "idle") {
    statusText.textContent = message;
    status.classList.toggle("is-running", state === "active");
    status.classList.toggle("is-error", state === "error");
  }

  function savePreference() {
    settingsStore?.set(STORAGE_KEY, enabled);
  }

  async function releaseWakeLock() {
    const currentLock = wakeLock;
    wakeLock = null;

    if (currentLock && !currentLock.released) {
      try {
        await currentLock.release();
      } catch (error) {
        console.warn("Không thể giải phóng Wake Lock:", error);
      }
    }
  }

  async function requestWakeLock() {
    if (!enabled || document.visibilityState !== "visible" || wakeLock || requesting) {
      return;
    }

    if (!("wakeLock" in navigator)) {
      setStatus("Trình duyệt này không hỗ trợ giữ màn hình sáng.", "error");
      toggle.disabled = true;
      return;
    }

    requesting = true;
    setStatus("Đang bật chế độ giữ màn hình sáng...");

    try {
      wakeLock = await navigator.wakeLock.request("screen");
      setStatus("Màn hình sẽ được giữ sáng khi ở trang này.", "active");

      wakeLock.addEventListener(
        "release",
        () => {
          wakeLock = null;

          if (enabled && document.visibilityState === "visible") {
            setStatus("Chế độ đã tạm ngắt. Chạm vào trang để bật lại.");
          } else if (!enabled) {
            setStatus("Giữ màn hình sáng đang tắt.");
          }
        },
        { once: true },
      );
    } catch (error) {
      wakeLock = null;

      if (error?.name === "NotAllowedError") {
        setStatus("Chạm vào trang để cho phép giữ màn hình sáng.");
      } else {
        console.warn("Không thể bật Screen Wake Lock:", error);
        setStatus("Không thể giữ màn hình sáng trên thiết bị này.", "error");
      }
    } finally {
      requesting = false;
    }
  }

  async function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    toggle.checked = enabled;
    savePreference();

    if (enabled) {
      await requestWakeLock();
    } else {
      await releaseWakeLock();
      setStatus("Giữ màn hình sáng đang tắt.");
    }
  }

  toggle.checked = enabled;
  toggle.addEventListener("change", () => {
    setEnabled(toggle.checked);
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && enabled) {
      await requestWakeLock();
    }
  });

  const retryFromUserGesture = () => {
    if (enabled && !wakeLock) {
      requestWakeLock();
    }
  };

  document.addEventListener("pointerdown", retryFromUserGesture, { passive: true });
  document.addEventListener("keydown", retryFromUserGesture);

  window.addEventListener("pagehide", releaseWakeLock);
  window.addEventListener("beforeunload", releaseWakeLock);

  if (enabled) {
    requestWakeLock();
  } else {
    setStatus("Giữ màn hình sáng đang tắt.");
  }
})();
