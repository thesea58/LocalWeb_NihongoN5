(() => {
  "use strict";

  const API_BASE = "/api";
  const SYNC_KEYS = [
    "toeic.current-rank",
    "toeic.selected-dataset",
    "toeic-auto-play-settings",
    "toeic-keep-screen-awake",
    "toeic-delay-vietnamese-meaning",
  ];
  const localStore = window.toeicStorage?.local;
  let user = null;
  let available = null;
  let syncTimer = null;
  const pendingSettings = new Map();

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message || `API lỗi (${response.status}).`);
      error.status = response.status;
      error.code = payload.error?.code || "api_error";
      throw error;
    }
    return payload;
  }

  function snapshot() {
    return Object.fromEntries(SYNC_KEYS.map((key) => [key, localStore?.get(key, null)]));
  }

  async function flush() {
    window.clearTimeout(syncTimer);
    syncTimer = null;
    if (!user || !pendingSettings.size) return false;
    const settings = Object.fromEntries(pendingSettings);
    pendingSettings.clear();
    try {
      await api("/settings", { method: "PUT", body: JSON.stringify({ settings }) });
      document.dispatchEvent(new CustomEvent("toeic:sync-status", { detail: { state: "synced" } }));
      return true;
    } catch (error) {
      Object.entries(settings).forEach(([key, value]) => pendingSettings.set(key, value));
      document.dispatchEvent(
        new CustomEvent("toeic:sync-status", { detail: { state: "error", message: error.message } }),
      );
      return false;
    }
  }

  function scheduleSetting(key, value) {
    if (!user || !SYNC_KEYS.includes(key)) return;
    pendingSettings.set(key, value);
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(flush, 1500);
    document.dispatchEvent(new CustomEvent("toeic:sync-status", { detail: { state: "pending" } }));
  }

  async function syncFromServer() {
    if (!user || !localStore) return { changed: false };
    const payload = await api("/settings");
    const serverSettings = payload.settings || {};
    const serverEntries = Object.entries(serverSettings).filter(([key]) => SYNC_KEYS.includes(key));

    if (!serverEntries.length) {
      const initialSettings = Object.fromEntries(
        Object.entries(snapshot()).filter(([, value]) => value !== null),
      );
      if (Object.keys(initialSettings).length) {
        await api("/settings", { method: "PUT", body: JSON.stringify({ settings: initialSettings }) });
      }
      return { changed: false, initialized: true };
    }

    let changed = false;
    serverEntries.forEach(([key, value]) => {
      if (JSON.stringify(localStore.get(key, null)) !== JSON.stringify(value)) {
        localStore.set(key, value, { silent: true });
        changed = true;
      }
    });
    if (changed) {
      document.dispatchEvent(new CustomEvent("toeic:remote-settings-applied"));
    }
    return { changed };
  }

  async function checkSession() {
    try {
      const payload = await api("/session");
      available = true;
      user = payload.user;
      const syncResult = await syncFromServer();
      return { available, user, ...syncResult };
    } catch (error) {
      available = Boolean(error.status && error.code !== "database_not_configured" && error.status !== 404 && error.status !== 503);
      user = null;
      return { available, user, error };
    }
  }

  async function login(username, password, turnstileToken = "") {
    const payload = await api("/login", {
      method: "POST",
      body: JSON.stringify({ username, password, turnstileToken }),
    });
    available = true;
    user = payload.user;
    const syncResult = await syncFromServer();
    document.dispatchEvent(new CustomEvent("toeic:auth-change", { detail: { user } }));
    return { user, ...syncResult };
  }

  async function logout() {
    await flush();
    await api("/logout", { method: "POST", body: "{}" });
    user = null;
    pendingSettings.clear();
    document.dispatchEvent(new CustomEvent("toeic:auth-change", { detail: { user: null } }));
  }

  document.addEventListener("toeic:setting-changed", (event) => {
    scheduleSetting(event.detail?.key, event.detail?.value);
  });
  window.addEventListener("online", flush);
  window.addEventListener("pagehide", () => {
    if (user && pendingSettings.size) {
      const settings = Object.fromEntries(pendingSettings);
      navigator.sendBeacon?.(`${API_BASE}/settings`, new Blob([JSON.stringify({ settings })], { type: "application/json" }));
    }
  });

  const ready = checkSession();
  window.toeicRemoteStorage = {
    ready,
    login,
    logout,
    flush,
    syncFromServer,
    getState: () => ({ available, user }),
  };
})();
