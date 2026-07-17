"use strict";

const CURRENT_RANK_KEY = "toeic.current-rank";
const QUEUE_KEY = "toeic.random-queue";
const SELECTED_DATASET_KEY = "toeic.selected-dataset";
const PROGRESS_KEY_PREFIX = "toeic.progress.";
const REVIEW_OPTIONS = [
  { result: "forgot", label: "Quên", detail: "ôn lại sau 10 phút" },
  { result: "hard", label: "Khó nhớ", detail: "ôn lại ngày mai" },
  { result: "good", label: "Nhớ", detail: "giãn cách ôn tập" },
  { result: "easy", label: "Dễ", detail: "giãn cách dài hơn" },
];
const localStore = window.toeicStorage?.local;
const sessionStore = window.toeicStorage?.session;

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
  positionProgress: document.getElementById("positionProgress"),
  jsonFileInput: document.getElementById("jsonFileInput"),
  toast: document.getElementById("toast"),
};

let vocabularies = [];
let currentIndex = 0;
let randomQueue = [];
let viewedRanks = new Set();
let progressByRank = new Map();
let currentDatasetId = "";
let studyMode = "all";
let reviewStartedAt = Date.now();
let sessionReviewCount = 0;
let progressLoadToken = 0;
let toastTimer = null;
let quickQuiz = null;

function createReviewDashboard() {
  const controls = document.querySelector(".controls");
  if (!controls || document.querySelector(".review-dashboard")) return;

  const dashboard = document.createElement("section");
  dashboard.className = "review-dashboard";
  dashboard.setAttribute("aria-label", "Lịch ôn tập");
  dashboard.innerHTML = `
    <div class="review-stats">
      <span><strong id="dueCount">0</strong> từ cần ôn</span>
      <span><strong id="weakCount">0</strong> từ yếu</span>
      <span><strong id="reviewedCount">0</strong> từ đã ghi nhận</span>
    </div>
    <div class="review-mode-tabs" role="tablist" aria-label="Chọn chế độ ôn">
      <button class="review-mode-button is-active" type="button" data-review-mode="all">Tất cả</button>
      <button class="review-mode-button" type="button" data-review-mode="due">Ôn hôm nay</button>
      <button class="review-mode-button" type="button" data-review-mode="weak">Từ khó</button>
    </div>
  `;
  controls.before(dashboard);
  elements.dueCount = dashboard.querySelector("#dueCount");
  elements.weakCount = dashboard.querySelector("#weakCount");
  elements.reviewedCount = dashboard.querySelector("#reviewedCount");
  elements.reviewModeButtons = [...dashboard.querySelectorAll("[data-review-mode]")];
}

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

function resolveDatasetId() {
  return window.toeicDatasetService?.getSelectedDataset?.()?.id
    || localStore?.get(SELECTED_DATASET_KEY, "")
    || "toeic-default";
}

function localProgressKey(datasetId = currentDatasetId) {
  return `${PROGRESS_KEY_PREFIX}${datasetId || "toeic-default"}`;
}

function normalizeProgressRow(row) {
  const rank = Number(row?.word_rank ?? row?.wordRank);
  if (!Number.isInteger(rank) || rank < 1) return null;
  return {
    word_rank: rank,
    status: String(row.status || "new"),
    correct_count: Math.max(0, Number(row.correct_count ?? row.correctCount) || 0),
    wrong_count: Math.max(0, Number(row.wrong_count ?? row.wrongCount) || 0),
    next_review_at: row.next_review_at ?? row.nextReviewAt ?? null,
    updated_at: row.updated_at ?? row.updatedAt ?? null,
    review_count: Math.max(0, Number(row.review_count ?? row.reviewCount) || 0),
    last_reviewed_at: row.last_reviewed_at ?? row.lastReviewedAt ?? null,
    last_result: row.last_result ?? row.lastResult ?? null,
    last_review_mode: row.last_review_mode ?? row.lastReviewMode ?? null,
    last_response_ms: Math.max(0, Number(row.last_response_ms ?? row.lastResponseMs) || 0),
    interval_days: Math.max(0, Number(row.interval_days ?? row.intervalDays) || 0),
    ease_factor: Math.max(1.3, Number(row.ease_factor ?? row.easeFactor) || 2.5),
  };
}

function loadLocalProgress(datasetId) {
  const stored = localStore?.get(localProgressKey(datasetId), {});
  const rows = Array.isArray(stored) ? stored : Object.values(stored || {});
  return new Map(rows.map(normalizeProgressRow).filter(Boolean).map((row) => [row.word_rank, row]));
}

function saveLocalProgress() {
  if (!currentDatasetId) return;
  localStore?.set(localProgressKey(), Object.fromEntries(progressByRank));
}

function isDue(progress) {
  if (!progress?.next_review_at) return false;
  const dueAt = new Date(progress.next_review_at).getTime();
  return Number.isFinite(dueAt) && dueAt <= Date.now();
}

function isWeak(progress) {
  if (!progress) return false;
  return progress.status === "review"
    || progress.status === "learning"
    || progress.last_result === "forgot"
    || progress.last_result === "hard"
    || progress.wrong_count > progress.correct_count;
}

function getStudyTargets(mode = studyMode) {
  if (!vocabularies.length || mode === "all") return vocabularies;
  const targets = vocabularies.filter((word) => {
    const progress = progressByRank.get(word.rank);
    return mode === "due" ? isDue(progress) : isWeak(progress);
  });
  return targets.sort((left, right) => {
    const leftProgress = progressByRank.get(left.rank);
    const rightProgress = progressByRank.get(right.rank);
    if (mode === "due") {
      return String(leftProgress?.next_review_at || "").localeCompare(String(rightProgress?.next_review_at || ""));
    }
    return (rightProgress?.wrong_count || 0) - (leftProgress?.wrong_count || 0);
  });
}

function updateReviewSummary() {
  const rows = [...progressByRank.values()];
  const dueCount = rows.filter(isDue).length;
  const weakCount = rows.filter(isWeak).length;
  if (elements.dueCount) elements.dueCount.textContent = String(dueCount);
  if (elements.weakCount) elements.weakCount.textContent = String(weakCount);
  if (elements.reviewedCount) elements.reviewedCount.textContent = String(rows.length);
  elements.reviewModeButtons?.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.reviewMode === studyMode);
  });
}

function formatNextReview(progress) {
  if (!progress?.next_review_at) return "Chưa có lịch ôn";
  const dueAt = new Date(progress.next_review_at).getTime();
  if (!Number.isFinite(dueAt)) return "Chưa có lịch ôn";
  const diffMs = dueAt - Date.now();
  if (diffMs <= 0) return "Đến hạn ôn";
  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `Ôn lại sau ${minutes} phút`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Ôn lại sau ${hours} giờ`;
  return `Ôn lại sau ${Math.ceil(hours / 24)} ngày`;
}

function reviewStatusText(progress) {
  if (!progress) return "Chưa đánh giá";
  const labels = {
    new: "Mới",
    learning: "Đang học",
    known: "Đã nhớ",
    review: "Cần ôn lại",
  };
  return labels[progress.status] || "Đang học";
}

function computeLocalReview(existing, reviewResult, responseMs) {
  const previousInterval = Math.max(0, Number(existing?.interval_days) || 0);
  const previousEase = Math.max(1.3, Number(existing?.ease_factor) || 2.5);
  let intervalDays = 1;
  let easeFactor = previousEase;
  let status = "learning";

  if (reviewResult === "forgot") {
    intervalDays = 10 / 1440;
    easeFactor = Math.max(1.3, previousEase - 0.25);
    status = "review";
  } else if (reviewResult === "hard") {
    intervalDays = previousInterval > 0 ? Math.max(1, previousInterval * 1.2) : 1;
    easeFactor = Math.max(1.3, previousEase - 0.15);
  } else if (reviewResult === "good") {
    intervalDays = previousInterval > 0 ? previousInterval * previousEase : 3;
    status = "known";
  } else {
    intervalDays = previousInterval > 0 ? previousInterval * 3.5 : 5;
    easeFactor = Math.min(4, previousEase + 0.15);
    status = "known";
  }

  const now = new Date();
  return {
    word_rank: vocabularies[currentIndex]?.rank,
    status,
    correct_count: Math.max(0, Number(existing?.correct_count) || 0) + (reviewResult === "forgot" ? 0 : 1),
    wrong_count: Math.max(0, Number(existing?.wrong_count) || 0) + (reviewResult === "forgot" ? 1 : 0),
    next_review_at: new Date(now.getTime() + intervalDays * 86400000).toISOString(),
    updated_at: now.toISOString(),
    review_count: Math.max(0, Number(existing?.review_count) || 0) + 1,
    last_reviewed_at: now.toISOString(),
    last_result: reviewResult,
    last_review_mode: "flashcard",
    last_response_ms: responseMs,
    interval_days: Math.round(intervalDays * 10000) / 10000,
    ease_factor: Math.round(easeFactor * 10000) / 10000,
  };
}

function getExamples(word) {
  const examples = word?.example_sentences;
  if (!examples || typeof examples !== "object") {
    return { english: "", japanese: "", vietnamese: "" };
  }

  return {
    english: typeof examples.english === "string" ? examples.english.trim() : "",
    japanese: typeof examples.japanese === "string" ? examples.japanese.trim() : "",
    vietnamese: typeof examples.vietnamese === "string" ? examples.vietnamese.trim() : "",
  };
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
        typeof word.vietnamese === "string",
    )
    .map((word) => ({
      ...word,
      rank: Number(word.rank ?? word.id),
      example_sentences: getExamples(word),
    }));

  if (!validWords.length) {
    throw new Error("Không tìm thấy từ vựng hợp lệ trong file JSON.");
  }

  return validWords.sort((left, right) => left.rank - right.rank);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function createQuickQuiz(word) {
  const distractors = shuffle(
    vocabularies
      .filter((item) => item.rank !== word.rank && item.vietnamese)
      .map((item) => item.vietnamese),
  )
    .filter((meaning, index, items) => items.indexOf(meaning) === index)
    .slice(0, 3);

  return {
    rank: word.rank,
    selected: "",
    choices: shuffle([word.vietnamese, ...distractors]),
  };
}

function getQuickQuiz(word) {
  if (!quickQuiz || quickQuiz.rank !== word.rank || quickQuiz.choices.length < 2) {
    quickQuiz = createQuickQuiz(word);
  }

  return quickQuiz;
}

function persistRandomQueue() {
  sessionStore?.set(QUEUE_KEY, { total: vocabularies.length, queue: randomQueue });
}

function createRandomQueue(excludedIndex) {
  randomQueue = shuffle(
    vocabularies.map((_, index) => index).filter((index) => index !== excludedIndex),
  );
  persistRandomQueue();
}

function restoreRandomQueue() {
  try {
    const stored = sessionStore?.get(QUEUE_KEY, null);
    const isValid =
      stored &&
      stored.total === vocabularies.length &&
      Array.isArray(stored.queue) &&
      stored.queue.every(
        (index) => Number.isInteger(index) && index >= 0 && index < vocabularies.length,
      );

    randomQueue = isValid ? [...new Set(stored.queue)] : [];
  } catch (error) {
    console.warn("Không thể khôi phục hàng đợi ngẫu nhiên:", error);
    randomQueue = [];
  }

  if (!randomQueue.length) {
    createRandomQueue(currentIndex);
  }
}

function setControlsDisabled(disabled) {
  elements.previousButton.disabled = disabled;
  elements.randomButton.disabled = disabled;
  elements.nextButton.disabled = disabled;
  elements.searchInput.disabled = disabled;
  elements.idInput.disabled = disabled;
}

async function hydrateProgress() {
  if (!vocabularies.length) return;
  const token = progressLoadToken + 1;
  progressLoadToken = token;
  currentDatasetId = resolveDatasetId();
  progressByRank = loadLocalProgress(currentDatasetId);
  updateReviewSummary();
  renderCurrentWord(false);

  const remote = window.toeicRemoteStorage;
  try {
    await remote?.ready;
    if (progressLoadToken !== token || !remote?.getState?.().user) return;
    const payload = await remote.getProgress(currentDatasetId);
    if (progressLoadToken !== token) return;
    progressByRank = new Map(
      (payload.progress || [])
        .map(normalizeProgressRow)
        .filter(Boolean)
        .map((row) => [row.word_rank, row]),
    );
    saveLocalProgress();
    updateReviewSummary();
    renderCurrentWord(false);
  } catch (error) {
    console.warn("Không thể đồng bộ tiến độ ôn tập:", error);
  }
}

function initializeVocabulary(words) {
  vocabularies = words;
  elements.totalWords.textContent = vocabularies.length.toLocaleString("vi-VN");
  elements.idInput.max = String(vocabularies.length);
  currentDatasetId = resolveDatasetId();
  progressByRank = loadLocalProgress(currentDatasetId);

  const savedRank = Number(localStore?.get(CURRENT_RANK_KEY, 0));
  const savedIndex = vocabularies.findIndex((word) => word.rank === savedRank);
  currentIndex = savedIndex >= 0 ? savedIndex : 0;

  restoreRandomQueue();
  setControlsDisabled(false);
  renderCurrentWord(false);
  hydrateProgress();
}

async function loadData() {
  try {
    const payload = window.toeicDatasetService
      ? await window.toeicDatasetService.loadSelectedPayload()
      : await fetch("../data/Eng-Ja-Vi/toeic_tsl_1_500_vocabularies_with_readings.json", { cache: "no-store" })
          .then((response) => {
            if (!response.ok) throw new Error(`Không tải được JSON (${response.status}).`);
            return response.json();
          });
    initializeVocabulary(validatePayload(payload));
  } catch (error) {
    console.error(error);
    showLoadError(error);
  }
}

function showLoadError(error) {
  setControlsDisabled(true);
  elements.cardHost.innerHTML = `
    <div class="error-state">
      <div>
        <h2>Không thể tải dữ liệu</h2>
        <p>${escapeHtml(error.message)}</p>
        <p>Hãy chạy website bằng web server hoặc chọn thủ công file JSON.</p>
        <button id="chooseFileButton" class="file-button" type="button">Chọn file JSON</button>
      </div>
    </div>
  `;

  document
    .getElementById("chooseFileButton")
    .addEventListener("click", () => elements.jsonFileInput.click());
}

function renderExampleSection(examples) {
  if (!examples.japanese && !examples.english && !examples.vietnamese) {
    return `
      <section class="translation-panel example-panel" aria-label="Câu ví dụ">
        <p class="section-label">例文 · Câu ví dụ</p>
        <p class="example-empty">Chưa có câu ví dụ cho từ này.</p>
      </section>
    `;
  }

  return `
    <section class="translation-panel example-panel" aria-labelledby="exampleTitle">
      <p id="exampleTitle" class="section-label">例文 · Example sentences · Câu ví dụ</p>
      <div class="example-list">
        <div class="example-item">
          <div class="example-heading japanese-row">
            <p class="section-label">日本語</p>
            ${examples.japanese ? `
              <button class="speak-button example-speak" type="button"
                data-speak="example-japanese" aria-label="Nghe câu ví dụ tiếng Nhật"
                title="Nghe câu ví dụ tiếng Nhật">🔊</button>
            ` : ""}
          </div>
          <p class="japanese-text example-japanese">${escapeHtml(examples.japanese || "—")}</p>
        </div>

        <div class="example-item">
          <div class="example-heading english-row">
            <p class="section-label">English</p>
            ${examples.english ? `
              <button class="speak-button example-speak" type="button"
                data-speak="example-english" aria-label="Nghe câu ví dụ tiếng Anh"
                title="Nghe câu ví dụ tiếng Anh">🔊</button>
            ` : ""}
          </div>
          <p class="example-english">${escapeHtml(examples.english || "—")}</p>
        </div>

        <div class="example-item">
          <p class="section-label">Tiếng Việt</p>
          <p class="example-vietnamese">${escapeHtml(examples.vietnamese || "—")}</p>
        </div>
      </div>
    </section>
  `;
}

function renderReviewPanel(word) {
  const progress = progressByRank.get(word.rank);
  const correct = progress?.correct_count || 0;
  const wrong = progress?.wrong_count || 0;
  const syncState = window.toeicRemoteStorage?.getState?.();
  const syncText = syncState?.user ? "Đồng bộ D1" : "Lưu trên máy";

  return `
    <section class="review-panel" aria-label="Đánh giá ghi nhớ">
      <div class="review-panel-head">
        <div>
          <p class="section-label">Retrieval practice</p>
          <h3>${reviewStatusText(progress)}</h3>
        </div>
        <div class="review-next">${formatNextReview(progress)}</div>
      </div>
      <div class="review-metrics" aria-label="Thống kê từ này">
        <span>Đúng <strong>${correct}</strong></span>
        <span>Sai <strong>${wrong}</strong></span>
        <span>Lần ôn <strong>${progress?.review_count || 0}</strong></span>
        <span>${syncText}</span>
      </div>
      <div class="review-actions" aria-label="Đánh giá kết quả nhớ lại">
        ${REVIEW_OPTIONS.map((option) => `
          <button class="review-action is-${option.result}" type="button" data-review-result="${option.result}">
            <strong>${option.label}</strong>
            <span>${option.detail}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderQuickQuizPanel(word) {
  const quiz = getQuickQuiz(word);
  const answered = Boolean(quiz.selected);
  const isCorrect = quiz.selected === word.vietnamese;

  return `
    <section class="quick-quiz-panel" aria-labelledby="quickQuizTitle">
      <div class="quick-quiz-head">
        <div>
          <p class="section-label">Quick TOEIC drill</p>
          <h3 id="quickQuizTitle">Chọn nghĩa đúng của từ <span>${escapeHtml(word.english)}</span></h3>
        </div>
        <button class="quick-quiz-reset" type="button" data-quick-quiz-reset>Đổi câu</button>
      </div>
      <div class="quick-quiz-prompt">
        <span class="quick-quiz-word">${escapeHtml(word.english)}</span>
        <small>${escapeHtml(word.japanese || "Japanese")} · ${escapeHtml(word.japanese_hiragana || "—")}</small>
      </div>
      <div class="quick-quiz-options" role="list" aria-label="Các đáp án nghĩa tiếng Việt">
        ${quiz.choices.map((choice, index) => {
          const stateClass = answered
            ? choice === word.vietnamese
              ? " is-correct"
              : choice === quiz.selected
                ? " is-wrong"
                : ""
            : "";
          return `
            <button class="quick-quiz-option${stateClass}" type="button"
              data-quick-quiz-choice="${escapeHtml(choice)}" ${answered ? "disabled" : ""}>
              <strong>${String.fromCharCode(65 + index)}</strong>
              <span>${escapeHtml(choice)}</span>
            </button>
          `;
        }).join("")}
      </div>
      ${answered ? `
        <p class="quick-quiz-feedback ${isCorrect ? "is-correct" : "is-wrong"}">
          ${isCorrect
            ? "Chính xác! Nếu bạn nhớ chắc, hãy bấm “Nhớ” hoặc “Dễ” ở phần Retrieval practice."
            : `Chưa đúng. Đáp án đúng là: ${escapeHtml(word.vietnamese)}.`}
        </p>
      ` : `
        <p class="quick-quiz-feedback">Luyện nhanh theo kiểu chọn đáp án giúp nhớ nghĩa trước khi ghi nhận kết quả ôn.</p>
      `}
    </section>
  `;
}

function renderCurrentWord(animate = true) {
  const word = vocabularies[currentIndex];
  if (!word) return;

  const examples = getExamples(word);
  viewedRanks.add(word.rank);
  localStore?.set(CURRENT_RANK_KEY, word.rank);
  elements.idInput.value = String(word.rank);
  elements.cardHost.classList.remove("animate-card");

  elements.cardHost.innerHTML = `
    <div class="card-topline">
      <span class="word-id">ID ${padId(word.rank)}</span>
      <span class="view-counter">Đã xem <strong>${viewedRanks.size}</strong> từ trong phiên</span>
    </div>

    <div class="language-section">
      <section class="english-block japanese-primary" aria-labelledby="japaneseWord">
        <p class="section-label">日本語 · Japanese</p>
        <div class="japanese-row">
          <h2 id="japaneseWord" class="japanese-text japanese-main">${escapeHtml(word.japanese)}</h2>
          <button class="speak-button" type="button" data-speak="japanese"
            aria-label="Nghe phát âm tiếng Nhật" title="Nghe tiếng Nhật">🔊</button>
        </div>
        <p class="hiragana">${escapeHtml(word.japanese_hiragana || "—")}</p>
      </section>

      <div class="translations">
        <section class="translation-panel" aria-labelledby="englishWord">
          <p class="section-label">English</p>
          <div class="english-row">
            <h3 id="englishWord" class="english-word english-secondary">${escapeHtml(word.english)}</h3>
            <button class="speak-button" type="button" data-speak="english"
              aria-label="Nghe phát âm tiếng Anh" title="Nghe tiếng Anh">🔊</button>
          </div>
          <p class="pronunciation">${escapeHtml(word.english_pronunciation_ipa || "—")}</p>
        </section>

        <section class="translation-panel" aria-labelledby="vietnameseWord">
          <p class="section-label">Tiếng Việt</p>
          <h3 id="vietnameseWord" class="vietnamese-text">${escapeHtml(word.vietnamese)}</h3>
        </section>
      </div>

      ${renderExampleSection(examples)}
      ${renderQuickQuizPanel(word)}
      ${renderReviewPanel(word)}
    </div>

    <footer class="card-footer">
      <span class="shortcut-hint">
        <kbd>←</kbd><kbd>→</kbd> chuyển từ · <kbd>R</kbd> ngẫu nhiên · <kbd>/</kbd> tìm kiếm
      </span>
      <button id="copyButton" class="copy-button" type="button"
        aria-label="Sao chép từ vựng" title="Sao chép">⧉</button>
    </footer>
  `;
  reviewStartedAt = Date.now();

  if (animate) {
    requestAnimationFrame(() => elements.cardHost.classList.add("animate-card"));
  }

  elements.cardHost
    .querySelector('[data-speak="japanese"]')
    .addEventListener("click", () => speak(word.japanese, "ja-JP"));
  elements.cardHost
    .querySelector('[data-speak="english"]')
    .addEventListener("click", () => speak(word.english, "en-US"));

  const japaneseExampleButton = elements.cardHost.querySelector('[data-speak="example-japanese"]');
  if (japaneseExampleButton) {
    japaneseExampleButton.addEventListener("click", () => speak(examples.japanese, "ja-JP"));
  }

  const englishExampleButton = elements.cardHost.querySelector('[data-speak="example-english"]');
  if (englishExampleButton) {
    englishExampleButton.addEventListener("click", () => speak(examples.english, "en-US"));
  }

  document.getElementById("copyButton").addEventListener("click", copyCurrentWord);
  elements.cardHost.querySelectorAll("[data-review-result]").forEach((button) => {
    button.addEventListener("click", () => handleReviewResult(button.dataset.reviewResult));
  });
  elements.cardHost.querySelectorAll("[data-quick-quiz-choice]").forEach((button) => {
    button.addEventListener("click", () => handleQuickQuizChoice(button.dataset.quickQuizChoice));
  });
  elements.cardHost.querySelector("[data-quick-quiz-reset]")?.addEventListener("click", resetQuickQuiz);
  updateNavigationStatus();
}

function handleQuickQuizChoice(choice) {
  const word = vocabularies[currentIndex];
  if (!word || !quickQuiz || quickQuiz.rank !== word.rank || quickQuiz.selected) return;
  quickQuiz.selected = choice;
  renderCurrentWord(false);
  showToast(choice === word.vietnamese ? "Quiz đúng! Tiếp tục ghi nhận mức nhớ." : "Quiz sai, hãy xem lại ví dụ và nghĩa.");
}

function resetQuickQuiz() {
  const word = vocabularies[currentIndex];
  if (!word) return;
  quickQuiz = createQuickQuiz(word);
  renderCurrentWord(false);
}

function updateNavigationStatus() {
  const word = vocabularies[currentIndex];
  if (!word) return;
  const progress = ((currentIndex + 1) / vocabularies.length) * 100;
  elements.positionText.textContent = `Từ ${currentIndex + 1} / ${vocabularies.length}`;
  elements.randomRemaining.textContent = `Ngẫu nhiên: còn ${randomQueue.length} từ chưa lặp`;
  if (studyMode !== "all") {
    const label = studyMode === "due" ? "Ôn hôm nay" : "Từ khó";
    elements.randomRemaining.textContent = `${label}: ${getStudyTargets().length} từ`;
  }
  elements.progressFill.style.width = `${progress}%`;
  elements.positionProgress?.setAttribute("aria-valuemax", String(vocabularies.length));
  elements.positionProgress?.setAttribute("aria-valuenow", String(currentIndex + 1));
  elements.previousButton.disabled = vocabularies.length <= 1;
  elements.nextButton.disabled = vocabularies.length <= 1;
  document.title = `${word.japanese} · ${word.english} · ID ${padId(word.rank)} | TOEIC Vocabulary`;
}

function moveByStudyTargets(offset) {
  const targets = getStudyTargets();
  if (!targets.length) {
    showToast(studyMode === "due" ? "Chưa có từ đến hạn ôn." : "Chưa có từ khó.");
    return true;
  }
  const currentRank = vocabularies[currentIndex]?.rank;
  const targetIndex = targets.findIndex((word) => word.rank === currentRank);
  const nextPosition = targetIndex >= 0 ? targetIndex + offset : 0;
  const nextTarget = targets[(nextPosition + targets.length) % targets.length];
  jumpToRank(nextTarget.rank, `${studyMode}-navigation`);
  return true;
}

function moveBy(offset) {
  if (!vocabularies.length) return;
  if (studyMode !== "all" && moveByStudyTargets(offset)) return;
  setCurrentIndex(
    (currentIndex + offset + vocabularies.length) % vocabularies.length,
    "navigation",
  );
}

function setCurrentIndex(nextIndex, source = "unknown") {
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= vocabularies.length) return;
  currentIndex = nextIndex;
  quickQuiz = null;
  renderCurrentWord();
  document.dispatchEvent(
    new CustomEvent("toeic:word-change", {
      detail: { index: currentIndex, rank: vocabularies[currentIndex]?.rank, source },
    }),
  );
}

function showRandomWord(source = "random") {
  if (vocabularies.length <= 1) return;
  if (studyMode !== "all") {
    const targets = getStudyTargets().filter((word) => word.rank !== vocabularies[currentIndex]?.rank);
    if (!targets.length) {
      showToast(studyMode === "due" ? "Chưa có từ đến hạn ôn." : "Chưa có từ khó.");
      return;
    }
    const nextWord = targets[Math.floor(Math.random() * targets.length)];
    jumpToRank(nextWord.rank, source);
    return;
  }
  if (!randomQueue.length) createRandomQueue(currentIndex);

  let nextIndex = randomQueue.pop();
  if (nextIndex === currentIndex && randomQueue.length) {
    const alternative = randomQueue.pop();
    randomQueue.unshift(nextIndex);
    nextIndex = alternative;
  }

  persistRandomQueue();
  setCurrentIndex(nextIndex, source);
}

function selectReviewMode(mode) {
  studyMode = ["all", "due", "weak"].includes(mode) ? mode : "all";
  updateReviewSummary();
  const targets = getStudyTargets();
  if (studyMode !== "all") {
    if (!targets.length) {
      showToast(studyMode === "due" ? "Chưa có từ đến hạn ôn." : "Chưa có từ khó.");
    } else {
      jumpToRank(targets[0].rank, `${studyMode}-mode`);
    }
  }
  updateNavigationStatus();
}

async function handleReviewResult(reviewResult) {
  if (!REVIEW_OPTIONS.some((option) => option.result === reviewResult)) return;
  const word = vocabularies[currentIndex];
  if (!word) return;

  const responseMs = Math.max(0, Date.now() - reviewStartedAt);
  const existing = progressByRank.get(word.rank);
  const optimistic = computeLocalReview(existing, reviewResult, responseMs);
  optimistic.word_rank = word.rank;
  progressByRank.set(word.rank, optimistic);
  sessionReviewCount += 1;
  saveLocalProgress();
  updateReviewSummary();
  renderCurrentWord(false);

  const remote = window.toeicRemoteStorage;
  if (!remote?.getState?.().user) {
    showToast("Đã lưu tiến độ trên máy. Đăng nhập để đồng bộ D1.");
  } else {
    try {
      const payload = await remote.recordReview(currentDatasetId, word.rank, {
        reviewResult,
        reviewMode: "flashcard",
        responseMs,
      });
      const synced = normalizeProgressRow(payload.progress);
      if (synced) {
        progressByRank.set(word.rank, synced);
        saveLocalProgress();
        updateReviewSummary();
        renderCurrentWord(false);
      }
      showToast("Đã đồng bộ lịch ôn tập.");
    } catch (error) {
      console.warn(error);
      showToast("Đã lưu trên máy; chưa đồng bộ D1.");
    }
  }

  if (studyMode !== "all") {
    window.setTimeout(() => moveByStudyTargets(1), 250);
  }
}

function jumpToRank(rank, source = "jump") {
  const index = vocabularies.findIndex((word) => word.rank === Number(rank));
  if (index < 0) {
    showToast(`Không tìm thấy ID ${rank}.`);
    return;
  }

  closeSearchResults();
  setCurrentIndex(index, source);
}

function renderSearchResults(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    closeSearchResults();
    return;
  }

  const matches = vocabularies
    .filter((word) => {
      const examples = getExamples(word);
      return [
        word.rank,
        word.english,
        word.english_pronunciation_ipa,
        word.japanese,
        word.japanese_hiragana,
        word.vietnamese,
        examples.english,
        examples.japanese,
        examples.vietnamese,
      ]
        .map(normalizeText)
        .join(" ")
        .includes(normalizedQuery);
    })
    .slice(0, 10);

  elements.searchResults.innerHTML = matches.length
    ? matches
        .map(
          (word) => `
            <button class="search-result" type="button" role="option" data-rank="${word.rank}">
              <span class="result-id">#${padId(word.rank)}</span>
              <span class="result-word">${escapeHtml(word.japanese)} · ${escapeHtml(word.english)}</span>
              <span class="result-meaning">${escapeHtml(word.vietnamese)}</span>
            </button>
          `,
        )
        .join("")
    : '<div class="result-meaning" style="padding: 14px;">Không tìm thấy từ phù hợp.</div>';

  elements.searchResults.classList.add("is-open");
  elements.searchInput.setAttribute("aria-expanded", "true");
  elements.searchResults.querySelectorAll("[data-rank]").forEach((button) => {
    button.addEventListener("click", () => jumpToRank(button.dataset.rank));
  });
}

function closeSearchResults() {
  elements.searchResults.classList.remove("is-open");
  elements.searchResults.innerHTML = "";
  elements.searchInput.setAttribute("aria-expanded", "false");
}

function speak(text, language) {
  if (typeof window.speak === "function") {
    window.speak(text, language);
    return;
  }
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
  const examples = getExamples(word);
  const text = [
    `ID: ${word.rank}`,
    `Japanese: ${word.japanese}`,
    `Hiragana: ${word.japanese_hiragana || ""}`,
    `English: ${word.english}`,
    `IPA: ${word.english_pronunciation_ipa || ""}`,
    `Vietnamese: ${word.vietnamese}`,
    "",
    "Example sentences:",
    `Japanese: ${examples.japanese}`,
    `English: ${examples.english}`,
    `Vietnamese: ${examples.vietnamese}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("Đã sao chép từ vựng và câu ví dụ.");
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

createReviewDashboard();
elements.reviewModeButtons?.forEach((button) => {
  button.addEventListener("click", () => selectReviewMode(button.dataset.reviewMode));
});

elements.previousButton.addEventListener("click", () => moveBy(-1));
elements.nextButton.addEventListener("click", () => moveBy(1));
elements.randomButton.addEventListener("click", () => showRandomWord("button-random"));

elements.idInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    jumpToRank(elements.idInput.value, "id-input");
    elements.idInput.blur();
  }
});

elements.idInput.addEventListener("change", () => {
  if (elements.idInput.value) jumpToRank(elements.idInput.value, "id-input");
});

elements.searchInput.addEventListener("input", (event) => {
  renderSearchResults(event.target.value);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".field-wrap")) closeSearchResults();
});

document.addEventListener("toeic:auth-change", () => {
  hydrateProgress();
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
  if (event.key.toLocaleLowerCase() === "r") showRandomWord("keyboard-random");
});

elements.jsonFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    initializeVocabulary(validatePayload(JSON.parse(await file.text())));
    showToast("Đã tải file JSON thành công.");
  } catch (error) {
    showLoadError(error);
  }
});

loadData();

window.toeicVocabularyApp = {
  showRandomWord,
  jumpToRank,
  getCurrentWord: () => vocabularies[currentIndex] || null,
};
