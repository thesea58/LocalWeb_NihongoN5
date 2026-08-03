import { escapeHtml } from "../utils/text.js";

function sanitizeLessonMarkup(source) {
  const document = new DOMParser().parseFromString(source, "text/html");
  document.querySelectorAll("script, style, iframe, object, embed, form, canvas").forEach((element) => element.remove());

  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || (name === "href" && !value.startsWith("#"))) element.removeAttribute(attribute.name);
    });
  });

  document.querySelectorAll("table").forEach((table) => {
    const wrapper = document.createElement("div");
    wrapper.className = "imported-table-wrap";
    table.replaceWith(wrapper);
    wrapper.append(table);
  });

  return document.body.innerHTML;
}

export async function renderImportedLesson(container, { title, asset, nextRoute, nextTitle, eyebrow = "Bài học · Cơ bản" }) {
  container.innerHTML = '<p class="loading-state">Đang tải nội dung bài học…</p>';

  try {
    const response = await fetch(new URL(asset, import.meta.url));
    if (!response.ok) throw new Error("Không thể tải nội dung bài học.");

    container.innerHTML = `
      <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><a href="#grammar">Ngữ pháp TOEIC</a><span>/</span><span>${escapeHtml(title)}</span></nav>
      <article class="lesson-article imported-lesson">
        <header class="lesson-header"><p class="eyebrow">${escapeHtml(eyebrow)}</p><a class="back-button" href="#grammar">← Quay lại Ngữ pháp TOEIC</a></header>
        <div class="imported-lesson-body">${sanitizeLessonMarkup(await response.text())}</div>
        <footer class="lesson-footer"><a class="back-button" href="#grammar">← Danh sách bài ngữ pháp</a><a class="next-lesson" href="${nextRoute}">${escapeHtml(nextTitle)} →</a></footer>
      </article>`;
  } catch (error) {
    container.innerHTML = `<p class="empty-search">${escapeHtml(error.message)}</p>`;
  }
}
