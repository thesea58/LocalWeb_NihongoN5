"use strict";

const DATASET_ID = "toeic-600-essential-en-vi";
const DATASET_URL = "../../../data/Eng-Ja-Vi/toeic_600_essential_words_en_vi.json?v=deadline-dash";
const LOCAL_PROGRESS_KEY = "deadline-dash.progress.v1";
const MISSION_SIZE = 12;

const elements = {
  syncState: document.getElementById("syncState"),
  accountName: document.getElementById("accountName"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  categorySelect: document.getElementById("categorySelect"),
  directionSelect: document.getElementById("directionSelect"),
  startButton: document.getElementById("startButton"),
  integrityFill: document.getElementById("integrityFill"),
  missionProgress: document.getElementById("missionProgress"),
  comboText: document.getElementById("comboText"),
  scoreText: document.getElementById("scoreText"),
  cardPanel: document.getElementById("cardPanel"),
  repairQueueText: document.getElementById("repairQueueText"),
  lastFeedback: document.getElementById("lastFeedback"),
  officeStage: document.querySelector(".office-stage"),
};

const state = {
  user: null,
  words: [],
  categories: [],
  progress: new Map(),
  missionWords: [],
  currentWord: null,
  currentChoices: [],
  currentStage: "idle",
  missionIndex: 0,
  score: 0,
  combo: 1,
  correct: 0,
  wrong: 0,
  hints: 0,
  currentHints: 0,
  lastRecallIndex: 0,
  repairQueue: [],
  weakWords: new Map(),
  recentWords: [],
  answered: false,
  stageStartedAt: Date.now(),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function loadLocalProgress() {
  try {
    const raw = window.localStorage.getItem(LOCAL_PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    state.progress = new Map(Object.entries(parsed).map(([rank, row]) => [Number(rank), row]));
  } catch {
    state.progress = new Map();
  }
}

function saveLocalProgress() {
  const data = Object.fromEntries(state.progress);
  window.localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(data));
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `API lỗi (${response.status}).`);
  }
  return payload;
}

async function checkSession() {
  try {
    const session = await api("/session");
    state.user = session.user;
    renderAccount();
    await syncProgressFromServer();
  } catch {
    state.user = null;
    renderAccount();
  }
}

function renderAccount() {
  if (state.user) {
    elements.syncState.textContent = "Đang đồng bộ Cloudflare D1";
    elements.accountName.textContent = state.user.displayName || state.user.username;
    elements.usernameInput.hidden = true;
    elements.passwordInput.hidden = true;
    elements.loginButton.hidden = true;
    elements.logoutButton.hidden = false;
  } else {
    elements.syncState.textContent = "Chưa đăng nhập";
    elements.accountName.textContent = "Lưu tiến độ trên máy";
    elements.usernameInput.hidden = false;
    elements.passwordInput.hidden = false;
    elements.loginButton.hidden = false;
    elements.logoutButton.hidden = true;
  }
}

async function syncProgressFromServer() {
  if (!state.user) return;
  try {
    const payload = await api(`/progress/${encodeURIComponent(DATASET_ID)}`);
    for (const row of payload.progress || []) {
      state.progress.set(Number(row.word_rank), row);
    }
    saveLocalProgress();
  } catch (error) {
    elements.syncState.textContent = error.message;
  }
}

async function recordReview(word, result, responseMs) {
  const current = state.progress.get(word.rank) || {
    word_rank: word.rank,
    correct_count: 0,
    wrong_count: 0,
    review_count: 0,
    status: "new",
  };
  const optimistic = {
    ...current,
    word_rank: word.rank,
    status: result === "forgot" ? "review" : result === "hard" ? "learning" : "known",
    correct_count: (current.correct_count || 0) + (result === "forgot" ? 0 : 1),
    wrong_count: (current.wrong_count || 0) + (result === "forgot" ? 1 : 0),
    review_count: (current.review_count || 0) + 1,
    last_result: result,
    last_response_ms: responseMs,
    last_reviewed_at: new Date().toISOString(),
  };
  state.progress.set(word.rank, optimistic);
  saveLocalProgress();

  if (!state.user) return;
  try {
    const payload = await api(`/progress/${encodeURIComponent(DATASET_ID)}/${word.rank}`, {
      method: "PUT",
      body: JSON.stringify({ reviewResult: result, reviewMode: "quiz", responseMs }),
    });
    if (payload.progress) {
      state.progress.set(word.rank, payload.progress);
      saveLocalProgress();
    }
  } catch (error) {
    elements.syncState.textContent = "Đã lưu trên máy; chưa đồng bộ D1.";
  }
}

function blankSentence(word) {
  const sentence = word.example_sentences?.english || `The office team must restore the word ${word.english} before the deadline.`;
  const escaped = word.english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  const marker = "___DEADLINE_DASH_BLANK___";
  if (pattern.test(sentence)) {
    return escapeHtml(sentence.replace(pattern, marker)).replace(marker, "<mark>______</mark>");
  }
  return `${escapeHtml(sentence)} <mark>______</mark>`;
}

function makeChoices(word) {
  const sameCategory = state.words.filter((item) =>
    item.rank !== word.rank
    && item.category === word.category
    && item.part_of_speech === word.part_of_speech,
  );
  const categoryFallback = state.words.filter((item) => item.rank !== word.rank && item.category === word.category);
  const generalFallback = state.words.filter((item) => item.rank !== word.rank && item.part_of_speech === word.part_of_speech);
  const pool = [...sameCategory, ...categoryFallback, ...generalFallback, ...state.words.filter((item) => item.rank !== word.rank)];
  const seen = new Set([word.english.toLowerCase()]);
  const distractors = [];
  for (const item of pool) {
    const key = item.english.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(item);
    if (distractors.length === 3) break;
  }
  return shuffle([word, ...distractors]).map((item) => ({
    rank: item.rank,
    english: item.english,
    vietnamese: item.vietnamese,
    correct: item.rank === word.rank,
  }));
}

function isDueOrWeak(word) {
  const progress = state.progress.get(word.rank);
  if (!progress) return false;
  const dueAt = progress.next_review_at ? new Date(progress.next_review_at).getTime() : Infinity;
  return progress.status === "review"
    || progress.status === "learning"
    || progress.last_result === "forgot"
    || progress.wrong_count > progress.correct_count
    || dueAt <= Date.now();
}

function buildMissionWords() {
  const category = elements.categorySelect.value;
  const categoryWords = state.words.filter((word) => category === "__all__" || word.category === category);
  const weak = shuffle(categoryWords.filter(isDueOrWeak)).slice(0, 6);
  const weakRanks = new Set(weak.map((word) => word.rank));
  const newWords = shuffle(categoryWords.filter((word) => !state.progress.has(word.rank) && !weakRanks.has(word.rank))).slice(0, 4);
  const selectedRanks = new Set([...weak, ...newWords].map((word) => word.rank));
  const filler = shuffle(categoryWords.filter((word) => !selectedRanks.has(word.rank))).slice(0, MISSION_SIZE - selectedRanks.size);
  return shuffle([...weak, ...newWords, ...filler]).slice(0, MISSION_SIZE);
}

function updateStatus() {
  const integrity = Math.max(0, Math.round(((MISSION_SIZE - state.wrong) / MISSION_SIZE) * 100));
  elements.integrityFill.style.width = `${integrity}%`;
  elements.officeStage.classList.toggle("is-stable", integrity >= 85);
  elements.missionProgress.textContent = `${Math.min(state.missionIndex, MISSION_SIZE)}/${MISSION_SIZE}`;
  elements.comboText.textContent = `×${state.combo.toFixed(1)}`;
  elements.scoreText.textContent = String(state.score);
  elements.repairQueueText.textContent = `${state.repairQueue.length} từ`;
}

function startMission() {
  state.missionWords = buildMissionWords();
  state.currentStage = "context";
  state.missionIndex = 0;
  state.score = 0;
  state.combo = 1;
  state.correct = 0;
  state.wrong = 0;
  state.hints = 0;
  state.currentHints = 0;
  state.lastRecallIndex = 0;
  state.repairQueue = [];
  state.weakWords = new Map();
  state.recentWords = [];
  elements.lastFeedback.textContent = "Nhiệm vụ bắt đầu. Khôi phục dữ liệu trước giờ họp.";
  updateStatus();
  showNextContext();
}

function showNextContext() {
  if (
    state.missionIndex > 0
    && state.missionIndex % 3 === 0
    && state.lastRecallIndex !== state.missionIndex
    && state.recentWords.length
  ) {
    state.lastRecallIndex = state.missionIndex;
    showRecallGate(state.recentWords[state.recentWords.length - 1]);
    return;
  }
  if (state.missionIndex >= state.missionWords.length) {
    showFinalRecovery();
    return;
  }
  const delayedRepair = state.repairQueue.find((item) => item.due <= state.missionIndex);
  if (delayedRepair) {
    state.repairQueue = state.repairQueue.filter((item) => item !== delayedRepair);
    state.currentWord = delayedRepair.word;
  } else {
    state.currentWord = state.missionWords[state.missionIndex];
    state.missionIndex += 1;
  }
  state.currentStage = "context";
  state.currentChoices = makeChoices(state.currentWord);
  state.answered = false;
  state.stageStartedAt = Date.now();
  renderContextQuestion();
  updateStatus();
}

function renderContextQuestion() {
  const word = state.currentWord;
  const directionSetting = elements.directionSelect.value;
  const direction = directionSetting === "mixed" && state.missionIndex > 6 ? "vi-en" : directionSetting;
  const prompt = direction === "vi-en"
    ? `<p class="sentence">${escapeHtml(word.vietnamese)}</p>`
    : `<p class="sentence">${blankSentence(word)}</p>`;
  const instruction = direction === "vi-en"
    ? "Chọn từ tiếng Anh phù hợp với nghĩa tiếng Việt."
    : "Chọn từ đúng để khôi phục email, hợp đồng hoặc thông báo. Phím nhanh: 1-4.";
  elements.cardPanel.innerHTML = `
    <article class="prompt-card">
      <p class="stage-label">Context Repair · ${escapeHtml(word.category)}</p>
      ${prompt}
      <p class="word-meta">${instruction}</p>
      <div class="answers">
        ${state.currentChoices.map((choice, index) => `
          <button class="answer-button" type="button" data-rank="${choice.rank}">
            <strong>${index + 1}. ${escapeHtml(choice.english)}</strong><br />
            <span>${escapeHtml(choice.vietnamese)}</span>
          </button>
        `).join("")}
      </div>
      <div id="feedback" class="feedback"></div>
    </article>
  `;
  elements.cardPanel.querySelectorAll("[data-rank]").forEach((button) => {
    button.addEventListener("click", () => answerContext(Number(button.dataset.rank)));
  });
}

async function answerContext(rank) {
  if (state.answered) return;
  state.answered = true;
  const word = state.currentWord;
  const selected = state.currentChoices.find((choice) => choice.rank === rank);
  const correct = rank === word.rank;
  const responseMs = Date.now() - state.stageStartedAt;

  elements.cardPanel.querySelectorAll("[data-rank]").forEach((button) => {
    const buttonRank = Number(button.dataset.rank);
    button.disabled = true;
    button.classList.toggle("is-correct", buttonRank === word.rank);
    button.classList.toggle("is-wrong", buttonRank === rank && !correct);
  });

  if (correct) {
    state.correct += 1;
    state.score += Math.round(100 * state.combo);
    state.combo = Math.min(2, state.combo + 0.1);
    state.recentWords.push(word);
    elements.lastFeedback.textContent = `${word.english}: ${word.vietnamese}`;
    await recordReview(word, responseMs < 3500 ? "easy" : "good", responseMs);
  } else {
    state.wrong += 1;
    state.combo = 1;
    state.repairQueue.push({ word, due: state.missionIndex + 2 });
    state.weakWords.set(word.rank, word);
    elements.lastFeedback.textContent = `${selected?.english || "Đáp án chọn"} chưa đúng. Đáp án cần khôi phục là ${word.english}.`;
    await recordReview(word, "forgot", responseMs);
  }

  const feedback = document.getElementById("feedback");
  feedback.innerHTML = correct
    ? `<strong>Đúng.</strong> ${escapeHtml(word.english)} ${escapeHtml(word.english_pronunciation_ipa || "")}: ${escapeHtml(word.vietnamese)}`
    : `<strong>Cần sửa.</strong> ${escapeHtml(word.english)} nghĩa là ${escapeHtml(word.vietnamese)}. Từ này đã được đưa vào Repair Queue.`;
  feedback.insertAdjacentHTML("afterend", `<button class="next-button" type="button">Tiếp tục</button>`);
  feedback.parentElement.querySelector(".next-button").addEventListener("click", showNextContext);
  updateStatus();
}

function showRecallGate(word) {
  state.currentStage = "recall";
  state.currentWord = word;
  state.answered = false;
  state.currentHints = 0;
  state.stageStartedAt = Date.now();
  elements.cardPanel.innerHTML = `
    <article class="prompt-card">
      <p class="stage-label">Recall Gate</p>
      <p class="sentence">${escapeHtml(word.vietnamese)}</p>
      <p class="word-meta">Nhập từ tiếng Anh. Đây là bước tự nhớ lại không có lựa chọn.</p>
      <input id="recallInput" class="recall-input" autocomplete="off" spellcheck="false" />
      <div class="hint-row">
        <button class="hint-button" type="button" data-hint="first">Gợi ý chữ đầu</button>
        <button class="hint-button" type="button" data-hint="sound">Nghe phát âm</button>
        <button class="hint-button" type="button" data-hint="length">Số ký tự</button>
      </div>
      <div id="feedback" class="feedback"></div>
    </article>
  `;
  const input = document.getElementById("recallInput");
  input.focus();
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") answerRecall(input.value);
  });
  elements.cardPanel.querySelectorAll("[data-hint]").forEach((button) => {
    button.addEventListener("click", () => useHint(button.dataset.hint, word));
  });
}

function useHint(kind, word) {
  state.hints += 1;
  state.currentHints += 1;
  const feedback = document.getElementById("feedback");
  if (kind === "first") feedback.textContent = `Chữ đầu: ${word.english.slice(0, 1)}`;
  if (kind === "length") feedback.textContent = `Số ký tự: ${word.english.replace(/\s/g, "").length}`;
  if (kind === "sound") {
    feedback.textContent = "Đã phát âm từ cần nhớ.";
    speak(word.english);
  }
}

async function answerRecall(value) {
  if (state.answered) return;
  state.answered = true;
  const word = state.currentWord;
  const correct = normalize(value) === normalize(word.english);
  const responseMs = Date.now() - state.stageStartedAt;
  const feedback = document.getElementById("feedback");
  if (correct) {
    state.correct += 1;
    state.score += state.currentHints ? 150 : 200;
    state.combo = Math.min(2, state.combo + 0.15);
    feedback.innerHTML = `<strong>Đã mở khóa.</strong> ${escapeHtml(word.english)}: ${escapeHtml(word.vietnamese)}`;
    await recordReview(word, state.currentHints ? "good" : "easy", responseMs);
  } else {
    state.wrong += 1;
    state.combo = 1;
    state.repairQueue.push({ word, due: state.missionIndex + 2 });
    state.weakWords.set(word.rank, word);
    feedback.innerHTML = `<strong>Chưa đúng.</strong> Đáp án là ${escapeHtml(word.english)}.`;
    await recordReview(word, "hard", responseMs);
  }
  feedback.insertAdjacentHTML("afterend", `<button class="next-button" type="button">Tiếp tục</button>`);
  feedback.parentElement.querySelector(".next-button").addEventListener("click", showNextContext);
  updateStatus();
}

function showFinalRecovery() {
  const finalWords = [...state.weakWords.values()].slice(0, 3);
  if (!finalWords.length) {
    showResults();
    return;
  }
  state.currentStage = "final";
  state.currentWord = finalWords[0];
  state.weakWords.delete(state.currentWord.rank);
  showRecallGate(state.currentWord);
  elements.cardPanel.querySelector(".stage-label").textContent = "Final Recovery";
}

function showResults() {
  const accuracy = state.correct + state.wrong ? Math.round((state.correct / (state.correct + state.wrong)) * 100) : 0;
  const rank = accuracy >= 95 && state.hints === 0 ? "Perfect" : accuracy >= 90 ? "Gold" : accuracy >= 80 ? "Silver" : "Bronze";
  elements.cardPanel.innerHTML = `
    <article class="prompt-card">
      <p class="stage-label">Kết quả nhiệm vụ</p>
      <p class="sentence">${rank}</p>
      <p class="word-meta">Trạng thái đã nhớ dựa trên lịch sử trả lời và sẽ tiếp tục xuất hiện trong lịch ôn nếu còn yếu.</p>
      <div class="result-grid">
        <div class="result-tile"><span>Điểm</span><strong>${state.score}</strong></div>
        <div class="result-tile"><span>Đúng</span><strong>${state.correct}</strong></div>
        <div class="result-tile"><span>Sai</span><strong>${state.wrong}</strong></div>
        <div class="result-tile"><span>Gợi ý</span><strong>${state.hints}</strong></div>
      </div>
      <button class="primary-action" type="button" id="restartMission">Chạy nhiệm vụ mới</button>
    </article>
  `;
  elements.lastFeedback.textContent = `Hoàn thành nhiệm vụ với hạng ${rank}.`;
  document.getElementById("restartMission").addEventListener("click", startMission);
  updateStatus();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

async function loadDataset() {
  const response = await fetch(DATASET_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không tải được dữ liệu TOEIC (${response.status}).`);
  const payload = await response.json();
  state.words = (payload.vocabularies || [])
    .filter((word) => word.english && word.vietnamese)
    .map((word) => ({ ...word, rank: Number(word.rank) }))
    .sort((left, right) => left.rank - right.rank);
  state.categories = [...new Set(state.words.map((word) => word.category).filter(Boolean))];
  elements.categorySelect.replaceChildren(
    new Option("Tất cả phòng ban", "__all__"),
    ...state.categories.map((category) => new Option(category, category)),
  );
  elements.categorySelect.disabled = false;
  elements.startButton.disabled = false;
}

elements.startButton.addEventListener("click", startMission);

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginButton.disabled = true;
  try {
    const payload = await api("/login", {
      method: "POST",
      body: JSON.stringify({
        username: elements.usernameInput.value,
        password: elements.passwordInput.value,
      }),
    });
    state.user = payload.user;
    elements.passwordInput.value = "";
    renderAccount();
    await syncProgressFromServer();
  } catch (error) {
    elements.syncState.textContent = error.message;
  } finally {
    elements.loginButton.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/logout", { method: "POST", body: "{}" }).catch(() => {});
  state.user = null;
  renderAccount();
});

document.addEventListener("keydown", (event) => {
  if (state.currentStage !== "context" || state.answered) return;
  const number = Number(event.key);
  if (number >= 1 && number <= state.currentChoices.length) {
    answerContext(state.currentChoices[number - 1].rank);
  }
});

loadLocalProgress();
renderAccount();
loadDataset()
  .then(checkSession)
  .catch((error) => {
    elements.cardPanel.innerHTML = `<div class="empty-state"><h2>Không tải được game</h2><p>${escapeHtml(error.message)}</p></div>`;
  });
