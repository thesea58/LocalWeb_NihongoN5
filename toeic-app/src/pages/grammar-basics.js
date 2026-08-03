import { escapeHtml } from "../utils/text.js";

const contentUrl = new URL("../../assets/content/grammar-basics-1.txt", import.meta.url);
const shortSubheadings = new Set([
  "Đại từ dùng để xưng hô",
  "Đại từ dùng để thay thế danh từ được nhắc đến trước đó",
  "Trạng từ bổ nghĩa cho động từ",
  "Trạng từ bổ nghĩa cho tính từ",
  "Trạng từ bổ nghĩa cho trạng từ khác",
  "Trạng từ bổ nghĩa cho cả câu",
  "Giới từ chỉ thời gian",
  "Giới từ chỉ nơi chốn",
  "Giới từ chỉ phương tiện",
  "Giới từ chỉ chủ đề",
  "Liên từ nối các từ",
  "Liên từ nối các cụm từ",
  "Liên từ nối các mệnh đề",
  "Cụm danh từ",
  "Cụm tính từ",
  "Cụm trạng từ",
  "Cụm giới từ",
]);

function nonEmptyEntries(lines, start) {
  const entries = [];
  for (let index = start; index < lines.length && entries.length < 14; index += 1) {
    if (lines[index].trim()) entries.push({ index, value: lines[index].trim() });
  }
  return entries;
}

function nounTypeTable(entries) {
  const [, countable, uncountable, singular, plural, ...words] = entries.map((entry) => entry.value);
  return `
    <figure class="source-table-wrap">
      <figcaption>VD:</figcaption>
      <table class="source-table">
        <thead><tr><th scope="col">Loại danh từ</th><th scope="col">Số ít</th><th scope="col">Số nhiều</th></tr></thead>
        <tbody>
          <tr><th scope="row">${escapeHtml(countable)}</th><td>${escapeHtml(words.slice(0, 3).join(", "))}</td><td>${escapeHtml(words.slice(3, 6).join(", "))}</td></tr>
          <tr><th scope="row">${escapeHtml(uncountable)}</th><td colspan="2">${escapeHtml(words.slice(6).join(", "))}</td></tr>
        </tbody>
      </table>
      <span class="source-table-legend">${escapeHtml(singular)} · ${escapeHtml(plural)}</span>
    </figure>`;
}

function renderBody(source) {
  const lines = source.replace(/\r/g, "").split("\n");
  const firstContent = lines.findIndex((line) => line.trim());
  const title = lines[firstContent]?.trim() || "Kiến thức cơ bản 1";
  const introductionIndex = lines.findIndex((line, index) => index > firstContent && line.trim());
  const introduction = lines[introductionIndex]?.trim() || "";
  const result = [];
  let sectionOpen = false;

  for (let index = introductionIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const tableEntries = nonEmptyEntries(lines, index);
    if (
      line === "VD:"
      && tableEntries[1]?.value.startsWith("Danh từ đếm được")
      && tableEntries[2]?.value.startsWith("Danh từ không đếm được")
    ) {
      result.push(nounTypeTable(tableEntries));
      index = tableEntries.at(-1).index;
      continue;
    }

    const section = line.match(/^(\d+)\.\s+(.+)$/);
    if (section) {
      const sectionId = section[1] === "1" ? "word-classes" : "phrases";
      if (sectionOpen) result.push("</section>");
      result.push(`<section id="${sectionId}" class="source-section"><h2>${escapeHtml(line)}</h2>`);
      sectionOpen = true;
      continue;
    }

    const subsection = line.match(/^\d+\.\d+\.\s+(.+)$/);
    if (subsection) {
      result.push(`<h3>${escapeHtml(line)}</h3>`);
      continue;
    }

    if (line.startsWith("Lưu ý:")) {
      result.push(`<aside class="lesson-callout source-note">${escapeHtml(line)}</aside>`);
      continue;
    }

    if (shortSubheadings.has(line)) {
      result.push(`<h4>${escapeHtml(line)}</h4>`);
      continue;
    }

    const isExample = line === "VD:" || line.startsWith("VD:") || line.startsWith("=>");
    result.push(`<p class="${isExample ? "source-example" : ""}">${escapeHtml(line)}</p>`);
  }

  return { introduction, markup: result.join("") + (sectionOpen ? "</section>" : "") };
}

export async function renderGrammarBasics(container) {
  container.innerHTML = '<p class="loading-state">Đang tải nội dung bài học…</p>';

  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw new Error("Không thể tải nội dung bài học.");

    const { introduction, markup } = renderBody(await response.text());
    container.innerHTML = `
      <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><a href="#grammar">Ngữ pháp TOEIC</a><span>/</span><span>Kiến thức cơ bản 1</span></nav>
      <article class="lesson-article source-lesson">
        <header class="lesson-header"><p class="eyebrow">Bài học · Cơ bản</p><h1>Kiến thức cơ bản 1: từ loại và cụm từ</h1><p class="lesson-lead">${escapeHtml(introduction)}</p><a class="back-button" href="#grammar">← Quay lại Ngữ pháp TOEIC</a></header>
        <nav class="lesson-index" aria-label="Mục lục bài học"><a href="#word-classes">1. Từ loại</a><a href="#phrases">2. Cụm từ</a></nav>
        ${markup}
        <footer class="lesson-footer"><a class="back-button" href="#grammar">← Danh sách bài ngữ pháp</a><a class="next-lesson" href="#grammar/basics-2">Bài tiếp theo: Mệnh đề và câu →</a></footer>
      </article>`;
  } catch (error) {
    container.innerHTML = `<p class="empty-search">${escapeHtml(error.message)}</p>`;
  }
}
