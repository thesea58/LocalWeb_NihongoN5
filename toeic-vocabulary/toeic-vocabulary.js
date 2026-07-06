"use strict";

const DATA_URL = "../data/Eng-Ja-Vi/toeic_tsl_1_500_vocabularies_with_readings.json";
const STORAGE_KEY = "toeic-vocabulary-current-rank";
const QUEUE_KEY = "toeic-vocabulary-random-queue";

const elements = {
  cardHost: document.getElementById("cardHost"),
  totalWords: document.getElementById("totalWords"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  idInput: document.getElementById("idInput"),
  previousButton: document.getElementById("previousButton"),
  randomButton: document.getElementById("randomButton"),
  nextButton: document.getElementById("nextButton"),
  positionText: document.getElementById("positionText"),
  randomRemaining: document.getElementById("randomRemaining"),
  progressFill: document.getElementById("progressFill"),
  jsonFileInput: document.getElementById("jsonFileInput"),
  toast: document.getElementById("toast"),
};

let vocabularies = [];
let currentIndex = 0;
let randomQueue = [];
let viewedRanks = new Set();
let toastTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();
}

function padId(rank) {
  return String(rank).padStart(3, "0");
}

function fisherYatesShuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function createRandomQueue(excludedIndex) {
  const candidates = vocabularies
    .map((_, index) => index)
    .filter((index) => index !== excludedIndex);
  randomQueue = fisherYatesShuffle(candidates);
  persistRandomQueue();
}

function restoreRandomQueue() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "null");
    if (
      stored &&
      stored.total === vocabularies.length &&
      Array.isArray(stored.queue) &&
      stored.queue.every(
        (index) => Number.isInteger(index) && index >= 0 && index < vocabularies.length
      )
    ) {
      randomQueue = [...new Set(stored.queue)];
    }
  } catch (error) {
    console.warn("Không thể khôi phục hàng đợi ngẫu nhiên:", error);
  }

  if (randomQueue.length === 0) {
    createRandomQueue(currentIndex);
  }
}

function persistRandomQueue() {
  try {
    sessionStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({ total: vocabularies.length, queue: randomQueue })
    );
  } catch (error) {
    console.warn("Không thể lưu hàng đợi ngẫu nhiên:", error);
  }
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.vocabularies)) {
    throw new Error("JSON không có mảng vocabularies hợp lệ.");
  }

  const validWords = payload.vocabularies
    .filter(
      (word) =>
        Number.isFinite(Number(word.rank ?? word.id)) &&
        typeof word.english === "string" &&
        typeof word.japanese === "string" &&
        typeof word.vietnamese === "string"
    )
    .map((word) => ({ ...word, rank: Number(word.rank ?? word.id) }));

  if (validWords.length === 0) {
    throw new Error("Không tìm thấy từ vựng hợp lệ trong file JSON.");
  }

  return validWords.sort((left, right) => left.rank - right.rank);
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Không tải được JSON (${response.status}).`);
    }
    const payload = await response.json();
    initializeVocabulary(validatePayload(payload));
  } catch (error) {
    console.error(error);
    showLoadError(error);
  }
}

function initializeVocabulary(words) {
  vocabularies = words;
  elements.totalWords.textContent = vocabularies.length.toLocaleString("vi-VN");
  elements.idInput.max = String(vocabularies.length);

  const savedRank = Number(localStorage.getItem(STORAGE_KEY));
  const savedIndex = vocabularies.findIndex((word) => Number(word.rank) === savedRank);
  currentIndex = savedIndex >= 0 ? savedIndex : 0;

  restoreRandomQueue();
  setControlsDisabled(false);
  renderCurrentWord(false);
}

function setControlsDisabled(disabled) {
  elements.previousButton.disabled = disabled;
  elements.randomButton.disabled = disabled;
  elements.nextButton.disabled = disabled;
  elements.searchInput.disabled = disabled;
  elements.idInput.disabled = disabled;
}

function showLoadError(error) {
  setControlsDisabled(true);
  elements.cardHost.innerHTML = `
    <div class="error-state">
      <div>
        <h2>Không thể tải dữ liệu</h2>
        <p>${escapeHtml(error.message)}</p>
        <p>
          Hãy chạy website bằng local server, hoặc chọn thủ công file<br />
          <code>toeic_tsl_1_500_vocabularies_with_readings.json</code>.
        </p>
        <button id="chooseFileButton" class="file-button" type="button">Chọn file JSON</button>
      </div>
    </div>
  `;
  document
    .getElementById("chooseFileButton")
    .addEventListener("click", () => elements.jsonFileInput.click());
}

function renderCurrentWord(animate = true) {
  const word = vocabularies[currentIndex];
  if (!word) return;

  viewedRanks.add(Number(word.rank));
  localStorage.setItem(STORAGE_KEY, String(word.rank));
  elements.idInput.value = String(word.rank);

  elements.cardHost.classList.remove("animate-card");
  elements.cardHost.innerHTML = `
    <div class="card-topline">
      <span class="word-id">ID ${padId(word.rank)}</span>
      <span class="view-counter">Đã xem <strong>${viewedRanks.size}</strong> từ trong phiên</span>
    </div>

    <div class="language-section">
      <section class="english-block" aria-labelledby="englishWord">
        <p class="section-label">English</p>
        <div class="english-row">
          <h2 id="englishWord" class="english-word">${escapeHtml(word.english)}</h2>
          <button
            class="speak-button"
            type="button"
            data-speak="english"
            aria-label="Nghe phát âm tiếng Anh"
            title="Nghe tiếng Anh"
          >🔊</button>
        </div>
        <p class="pronunciation">${escapeHtml(word.english_pronunciation_ipa || "—")}</p>
      </section>

      <div class="translations">
        <section class="translation-panel" aria-labelledby="japaneseWord">
          <p class="section-label">日本語 · Japanese</p>
          <div class="japanese-row">
            <h3 id="japaneseWord" class="japanese-text">${escapeHtml(word.japanese)}</h3>
            <button
              class="speak-button"
              type="button"
              data-speak="japanese"
              aria-label="Nghe phát âm tiếng Nhật"
              title="Nghe tiếng Nhật"
            >🔊</button>
          </div>
          <p class="hiragana">${escapeHtml(word.japanese_hiragana || "—")}</p>
        </section>

        <section class="translation-panel" aria-labelledby="vietnameseWord">
          <p class="section-label">Tiếng Việt</p>
          <h3 id="vietnameseWord" class="vietnamese-text">${escapeHtml(word.vietnamese)}</h3>
        </section>
      </div>
    </div>

    <footer class="card-footer">
      <span class="shortcut-hint">
        <kbd>←</kbd><kbd>→</kbd> chuyển từ · <kbd>R</kbd> ngẫu nhiên · <kbd>/</kbd> tìm kiếm
      </span>
      <button id="copyButton" class="copy-button" type="button" aria-label="Sao chép từ vựng" title="Sao chép">⧉</button>
    </footer>
  `;

  if (animate) {
    requestAnimationFrame(() => elements.cardHost.classList.add("animate-card"));
  }

  elements.cardHost
    .querySelector('[data-speak="english"]')
    .addEventListener("click", () => speak(word.english, "en-US"));
  elements.cardHost
    .querySelector('[data-speak="japanese"]')
    .addEventListener("click", () => speak(word.japanese, "ja-JP"));
  document.getElementById("copyButton").addEventListener("click", copyCurrentWord);

  updateNavigationStatus();
}

function updateNavigationStatus() {
  const word = vocabularies[currentIndex];
  const progress = ((currentIndex + 1) / vocabularies.length) * 100;
  elements.positionText.textContent = `Từ ${currentIndex + 1} / ${vocabularies.length}`;
  elements.randomRemaining.textContent = `Ngẫu nhiên: còn ${randomQueue.length} từ chưa lặp`;
  elements.progressFill.style.width = `${progress}%`;
  elements.previousButton.disabled = vocabularies.length <= 1;
  elements.nextButton.disabled = vocabularies.length <= 1;
  document.title = `${word.english} · ID ${padId(word.rank)} | TOEIC Vocabulary`;
}

function moveBy(offset) {
  if (vocabularies.length === 0) return;
  currentIndex = (currentIndex + offset + vocabularies.length) % vocabularies.length;
  renderCurrentWord();
}

function showRandomWord() {
  if (vocabularies.length <= 1) return;

  if (randomQueue.length === 0) {
    createRandomQueue(currentIndex);
  }

  let nextIndex = randomQueue.pop();
  if (nextIndex === currentIndex && randomQueue.length > 0) {
    const alternative = randomQueue.pop();
    randomQueue.unshift(nextIndex);
    nextIndex = alternative;
  }

  currentIndex = nextIndex;
  persistRandomQueue();
  renderCurrentWord();
}

function jumpToRank(rank) {
  const numericRank = Number(rank);
  const index = vocabularies.findIndex((word) => Number(word.rank) === numericRank);
  if (index < 0) {
    showToast(`Không tìm thấy ID ${rank}.`);
    return;
  }
  currentIndex = index;
  closeSearchResults();
  renderCurrentWord();
}

function renderSearchResults(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    closeSearchResults();
    return;
  }

  const matches = vocabularies
    .filter((word) => {
      const searchable = [
        word.rank,
        word.english,
        word.english_pronunciation_ipa,
        word.japanese,
        word.japanese_hiragana,
        word.vietnamese,
      ]
        .map(normalizeText)
        .join(" ");
      return searchable.includes(normalizedQuery);
    })
    .slice(0, 10);

  elements.searchResults.innerHTML = matches.length
    ? matches
        .map(
          (word) => `
            <button class="search-result" type="button" role="option" data-rank="${word.rank}">
              <span class="result-id">#${padId(word.rank)}</span>
              <span class="result-word">${escapeHtml(word.english)} · ${escapeHtml(word.japanese)}</span>
              <span class="result-meaning">${escapeHtml(word.vietnamese)}</span>
            </button>
          `
        )
        .join("")
    : '<div class="result-meaning" style="padding: 14px;">Không tìm thấy từ phù hợp.</div>';

  elements.searchResults.classList.add("is-open");
  elements.searchResults
    .querySelectorAll("[data-rank]")
    .forEach((button) => button.addEventListener("click", () => jumpToRank(button.dataset.rank)));
}

function closeSearchResults() {
  elements.searchResults.classList.remove("is-open");
  elements.searchResults.innerHTML = "";
}

function speak(text, language) {
  if (!("speechSynthesis" in window)) {
    showToast("Trình duyệt này chưa hỗ trợ phát âm.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = language === "ja-JP" ? 0.85 : 0.9;
  window.speechSynthesis.speak(utterance);
}

async function copyCurrentWord() {
  const word = vocabularies[currentIndex];
  const text = [
    `ID: ${word.rank}`,
    `English: ${word.english}`,
    `IPA: ${word.english_pronunciation_ipa || ""}`,
    `Japanese: ${word.japanese}`,
    `Hiragana: ${word.japanese_hiragana || ""}`,
    `Vietnamese: ${word.vietnamese}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("Đã sao chép từ vựng.");
  } catch (error) {
    console.warn(error);
    showToast("Không thể sao chép trong trình duyệt này.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
}

elements.previousButton.addEventListener("click", () => moveBy(-1));
elements.nextButton.addEventListener("click", () => moveBy(1));
elements.randomButton.addEventListener("click", showRandomWord);

elements.idInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    jumpToRank(elements.idInput.value);
    elements.idInput.blur();
  }
});

elements.idInput.addEventListener("change", () => {
  if (elements.idInput.value) jumpToRank(elements.idInput.value);
});

elements.searchInput.addEventListener("input", (event) => {
  renderSearchResults(event.target.value);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".field-wrap")) closeSearchResults();
});

document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";

  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    elements.searchInput.focus();
    return;
  }
  if (isTyping) return;

  if (event.key === "ArrowLeft") moveBy(-1);
  if (event.key === "ArrowRight") moveBy(1);
  if (event.key.toLocaleLowerCase() === "r") showRandomWord();
});

elements.jsonFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    initializeVocabulary(validatePayload(payload));
    showToast("Đã tải file JSON thành công.");
  } catch (error) {
    showLoadError(error);
  }
});

loadData();
