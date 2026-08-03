import { escapeHtml, normalizeText } from "../utils/text.js";

const pageSize = 12;
let vocabularyCache;

async function loadVocabulary() {
  if (!vocabularyCache) {
    vocabularyCache = fetch("./assets/data/list-20.json")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Không thể tải danh sách từ vựng.")))
      .then((data) => Array.isArray(data.vocabulary) ? data.vocabulary : []);
  }
  return vocabularyCache;
}

function matches(word, query) {
  return normalizeText([word.word, word.part_of_speech, word.pronunciation, word.definition?.vietnamese, word.definition?.english, ...(word.examples || []).flatMap((example) => [example.english, example.vietnamese])].join(" ")).includes(query);
}

function highlight(value, query) {
  const text = String(value ?? "");
  const position = normalizeText(text).indexOf(query);
  if (!query || position < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, position))}<mark>${escapeHtml(text.slice(position, position + query.length))}</mark>${escapeHtml(text.slice(position + query.length))}`;
}

function speak(word) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

export async function renderFlashcards(container) {
  container.innerHTML = '<div class="loading-state">Đang tải danh sách từ vựng…</div>';
  try {
    const vocabulary = await loadVocabulary();
    const state = { items: vocabulary, page: 1, query: "" };
    container.innerHTML = `
      <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><a href="#vocabulary">Từ vựng TOEIC</a><span>/</span><span>List 20</span></nav>
      <section class="course-title-row" aria-labelledby="flashcardTitle"><div><p class="eyebrow">Từ vựng TOEIC</p><h1 id="flashcardTitle">List 20 · Flashcards</h1><p class="hero-copy">Học từ vựng theo ngữ cảnh: xem nghĩa, nghe phát âm và đọc ví dụ song ngữ.</p></div><div class="list-actions"><a class="back-button" href="#vocabulary">← Quay lại danh sách</a><button class="secondary-button" type="button" data-random>⤨ Xem từ ngẫu nhiên</button></div></section>
      <section class="study-tools" aria-label="Công cụ học từ vựng"><div class="word-count"><span>${vocabulary.length}</span><small>từ trong List 20</small></div><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" autocomplete="off" placeholder="Tìm từ, nghĩa hoặc ví dụ..." aria-label="Tìm từ vựng"></label><p class="result-summary" aria-live="polite"></p></section>
      <section class="vocabulary-panel" aria-labelledby="listTitle"><div class="panel-title"><div><p class="eyebrow">Danh sách từ vựng</p><h2 id="listTitle">Nghĩa, phát âm &amp; ví dụ</h2></div></div><div class="vocabulary-list"></div><nav class="pagination" aria-label="Chuyển trang từ vựng"></nav></section>
    `;
    const list = container.querySelector(".vocabulary-list");
    const pagination = container.querySelector(".pagination");
    const search = container.querySelector("input");
    const summary = container.querySelector(".result-summary");
    const draw = () => {
      const pages = Math.max(1, Math.ceil(state.items.length / pageSize));
      state.page = Math.min(state.page, pages);
      const start = (state.page - 1) * pageSize;
      const currentItems = state.items.slice(start, start + pageSize);
      list.innerHTML = currentItems.map((word) => `<article class="word-card"><div class="word-heading"><div><h3 class="word-name">${highlight(word.word, state.query)} <em>(${escapeHtml(word.part_of_speech)})</em></h3><p class="pronunciation">${escapeHtml(word.pronunciation)}</p></div><button class="speak-button" type="button" data-word="${escapeHtml(word.word)}" aria-label="Nghe phát âm ${escapeHtml(word.word)}">🔊 <span>Nghe</span></button></div><div class="definition"><span class="label">Định nghĩa</span><p class="meaning-vietnamese">${highlight(word.definition?.vietnamese?.replace(/^Định nghĩa:\s*/i, ""), state.query)}</p><p class="meaning-english">${highlight(word.definition?.english, state.query)}</p></div><div class="examples"><span class="label">Ví dụ</span><ol class="example-list">${(word.examples || []).map((example) => `<li>${highlight(example.english, state.query)}<br><em>(${highlight(example.vietnamese, state.query)})</em></li>`).join("")}</ol></div></article>`).join("") || '<div class="empty-search">Không tìm thấy từ phù hợp.</div>';
      list.querySelectorAll("[data-word]").forEach((button) => button.addEventListener("click", () => speak(vocabulary.find((word) => word.word === button.dataset.word))));
      pagination.innerHTML = ["←", ...Array.from({ length: pages }, (_, index) => String(index + 1)), "→"].map((label, index, all) => { const isPrevious = index === 0; const isNext = index === all.length - 1; const page = isPrevious ? state.page - 1 : isNext ? state.page + 1 : Number(label); const disabled = (isPrevious && state.page === 1) || (isNext && state.page === pages); return `<button class="page-button" type="button" data-page="${page}" ${disabled ? "disabled" : ""} ${page === state.page && !isPrevious && !isNext ? 'aria-current="page"' : ""}>${label}</button>`; }).join("");
      pagination.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => { state.page = Number(button.dataset.page); draw(); window.scrollTo({ top: 0, behavior: "smooth" }); }));
      summary.textContent = state.items.length === vocabulary.length ? `Trang ${state.page} / ${pages}` : `${state.items.length} kết quả`;
    };
    search.addEventListener("input", () => { state.query = normalizeText(search.value.trim()); state.items = state.query ? vocabulary.filter((word) => matches(word, state.query)) : vocabulary; state.page = 1; draw(); });
    container.querySelector("[data-random]").addEventListener("click", () => { if (!state.items.length) return; const selected = state.items[Math.floor(Math.random() * state.items.length)]; state.page = Math.floor(state.items.indexOf(selected) / pageSize) + 1; draw(); const card = list.children[state.items.indexOf(selected) % pageSize]; card?.scrollIntoView({ behavior: "smooth", block: "center" }); card?.classList.add("is-highlighted"); window.setTimeout(() => card?.classList.remove("is-highlighted"), 1400); });
    draw();
  } catch (error) {
    container.innerHTML = `<div class="loading-state">${escapeHtml(error.message)}</div>`;
  }
}
