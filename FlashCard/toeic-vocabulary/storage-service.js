(() => {
  "use strict";

  const PREFIX = "nihongo-study:";
  const LEGACY_KEYS = {
    "toeic.current-rank": "toeic-vocabulary-current-rank",
    "toeic.random-queue": "toeic-vocabulary-random-queue",
    "toeic.selected-dataset": "toeic-vocabulary-selected-dataset",
    "toeic-auto-play-settings": "toeic-auto-play-settings",
    "toeic-keep-screen-awake": "toeic-keep-screen-awake",
    "toeic-delay-vietnamese-meaning": "toeic-delay-vietnamese-meaning",
  };

  function getStorage(kind) {
    try {
      return kind === "session" ? window.sessionStorage : window.localStorage;
    } catch (error) {
      console.warn(`Không thể truy cập ${kind}Storage:`, error);
      return null;
    }
  }

  function createStore(kind) {
    const storage = getStorage(kind);

    return {
      get(key, fallback = null) {
        if (!storage) return fallback;
        try {
          const value = storage.getItem(`${PREFIX}${key}`);
          if (value !== null) return JSON.parse(value);

          const legacyKey = LEGACY_KEYS[key];
          const legacyValue = legacyKey ? storage.getItem(legacyKey) : null;
          if (legacyValue === null) return fallback;

          try {
            return JSON.parse(legacyValue);
          } catch {
            return legacyValue;
          }
        } catch (error) {
          console.warn(`Không thể đọc thiết lập ${key}:`, error);
          return fallback;
        }
      },

      set(key, value) {
        if (!storage) return false;
        try {
          storage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
          return true;
        } catch (error) {
          console.warn(`Không thể lưu thiết lập ${key}:`, error);
          return false;
        }
      },

      remove(key) {
        if (!storage) return false;
        try {
          storage.removeItem(`${PREFIX}${key}`);
          return true;
        } catch (error) {
          console.warn(`Không thể xóa thiết lập ${key}:`, error);
          return false;
        }
      },
    };
  }

  window.toeicStorage = {
    local: createStore("local"),
    session: createStore("session"),
    prefix: PREFIX,
  };
})();
