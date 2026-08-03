import { escapeHtml } from "../utils/text.js";

const practiceAsset = new URL("../../assets/data/noun-toeic-practice.json?build=practice-source-v3", import.meta.url);

async function loadPracticeQuestions() {
  const response = await fetch(practiceAsset);
  if (!response.ok) throw new Error("Không thể tải dữ liệu bài luyện tập.");
  const source = await response.json();
  if (!Array.isArray(source.questions) || source.questions.length === 0) {
    throw new Error("Bài luyện tập chưa có dữ liệu.");
  }
  return source.questions.map((question) => ({
    ...question,
    type: "choice",
    answer: question.answer.charCodeAt(0) - 65,
  }));
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function isAnswered(value) {
  return value !== null;
}

function choiceMarkup(question, selected, checked) {
  return `<div class="answer-options" role="radiogroup" aria-label="Đáp án">${question.options.map((option, index) => `<label class="answer-option ${checked && index === question.answer ? "is-correct" : ""} ${checked && selected === index && index !== question.answer ? "is-incorrect" : ""}"><input type="radio" name="answer" value="${index}" data-choice ${selected === index ? "checked" : ""}><span>${optionLabel(index)}.</span>${escapeHtml(option)}</label>`).join("")}</div>`;
}

function explanationMarkup(question) {
  if (!question.explanation?.length) return "";
  const translation = question.translation ? `<p><strong>Dịch:</strong> ${escapeHtml(question.translation)}</p>` : "";
  const vocabulary = question.vocabulary?.length ? `<div><strong>Từ vựng:</strong><ul>${question.vocabulary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
  return `<section class="practice-explanation"><h2>Giải thích đáp án</h2>${question.explanation.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}${translation}${vocabulary}</section>`;
}

function renderLoadError(container) {
  container.innerHTML = `<main class="practice-page"><section class="empty-state"><p class="eyebrow">Luyện tập</p><h1>Không thể mở bài luyện tập</h1><p>Vui lòng tải lại trang để thử lại.</p><a class="primary-button" href="#grammar">← Quay lại Ngữ pháp TOEIC</a></section></main>`;
}

export async function renderPracticeSession(container, { lessonTitle, practiceTitle }) {
  container.innerHTML = `<main class="practice-page"><section class="empty-state"><p class="eyebrow">Luyện tập</p><p>Đang tải bài tập…</p></section></main>`;

  let questions;
  try {
    questions = await loadPracticeQuestions();
  } catch {
    renderLoadError(container);
    return;
  }

  const state = {
    autoAdvance: true,
    current: 0,
    answers: Array(questions.length).fill(null),
    checked: false,
    highlight: true,
  };

  const draw = () => {
    const question = questions[state.current];
    const answer = state.answers[state.current];
    const answered = isAnswered(answer);
    const correct = answered && answer === question.answer;
    container.innerHTML = `
      <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><a href="#grammar">Ngữ pháp TOEIC</a><span>/</span><span>${escapeHtml(lessonTitle)}</span></nav>
      <main class="practice-page">
        <header class="practice-header"><div><p class="eyebrow">Luyện tập</p><h1>${escapeHtml(practiceTitle)}</h1><p>${escapeHtml(lessonTitle)}</p></div><a class="back-button" href="#grammar">← Quay lại Ngữ pháp TOEIC</a></header>
        <section class="practice-workspace" aria-label="Khu vực làm bài">
          <div class="practice-toolbar"><label class="practice-switch"><input type="checkbox" data-action="highlight" ${state.highlight ? "checked" : ""}><span></span>Highlight nội dung</label><div class="practice-actions"><button class="secondary-button" type="button" data-action="check">✓ Kiểm tra đáp án</button><button class="secondary-button" type="button" data-action="reset">↺ Xoá hết</button></div></div>
          <article class="question-card ${state.highlight ? "is-highlighted" : ""}"><p class="question-count">Q${escapeHtml(question.number)} · Câu ${state.current + 1}/${questions.length} · Trắc nghiệm</p><p class="question-prompt">${escapeHtml(question.prompt)}</p>${choiceMarkup(question, answer, state.checked)}${state.checked && answered ? `<p class="answer-feedback ${correct ? "is-correct" : "is-incorrect"}">${correct ? "✓ Chính xác." : `Chưa chính xác. Đáp án đúng: ${optionLabel(question.answer)}. ${escapeHtml(question.options[question.answer])}`}</p>${explanationMarkup(question)}` : ""}</article>
          <section class="question-controls" aria-label="Điều hướng câu hỏi"><button class="secondary-button" type="button" data-action="previous" ${state.current === 0 ? "disabled" : ""}>← Câu trước</button><label class="practice-switch"><input type="checkbox" data-action="auto" ${state.autoAdvance ? "checked" : ""}><span></span>Tự động chuyển câu</label><button class="secondary-button" type="button" data-action="next" ${state.current === questions.length - 1 ? "disabled" : ""}>Câu sau →</button></section>
          <section class="question-palette"><h2>Danh sách bài tập</h2><div>${questions.map((item, index) => `<button type="button" class="question-number ${index === state.current ? "is-current" : ""} ${isAnswered(state.answers[index]) ? "is-answered" : ""}" data-question="${index}" aria-label="Câu ${index + 1}" ${index === state.current ? 'aria-current="step"' : ""}>${index + 1}</button>`).join("")}</div></section>
        </section>
      </main>`;

    const changeAnswer = (value) => {
      state.answers[state.current] = value;
      state.checked = false;
      if (state.autoAdvance && state.current < questions.length - 1) state.current += 1;
      draw();
    };

    container.querySelector('[data-action="highlight"]').addEventListener("change", (event) => { state.highlight = event.target.checked; draw(); });
    container.querySelector('[data-action="auto"]').addEventListener("change", (event) => { state.autoAdvance = event.target.checked; draw(); });
    container.querySelector('[data-action="check"]').addEventListener("click", () => { state.checked = true; draw(); });
    container.querySelector('[data-action="reset"]').addEventListener("click", () => { state.answers.fill(null); state.checked = false; draw(); });
    container.querySelector('[data-action="previous"]').addEventListener("click", () => { state.current = Math.max(0, state.current - 1); draw(); });
    container.querySelector('[data-action="next"]').addEventListener("click", () => { state.current = Math.min(questions.length - 1, state.current + 1); draw(); });
    container.querySelectorAll("[data-question]").forEach((button) => button.addEventListener("click", () => { state.current = Number(button.dataset.question); draw(); }));
    container.querySelectorAll("[data-choice]").forEach((input) => input.addEventListener("change", (event) => changeAnswer(Number(event.target.value))));
  };

  draw();
}
