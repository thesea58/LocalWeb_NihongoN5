import { chapterLabel } from "../config/course.js";
import { escapeHtml } from "../utils/text.js";

export function renderTodoPage(container, route) {
  const activityName = route.activity ? route.activity.replaceAll("-", " ") : "";
  const title = route.list ? `${route.list.replace("list-", "List ")} · ${activityName || "Bài học"}` : chapterLabel(route.chapter);
  const safeTitle = escapeHtml(title);
  container.innerHTML = `<section class="todo-page"><nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><span>${safeTitle}</span></nav><div class="todo-card"><span class="todo-icon" aria-hidden="true">✦</span><p class="eyebrow">Đang chuẩn bị</p><h1>${safeTitle}</h1><p>Chưa có nội dung cho mục này. Phần này được để trống để bổ sung trong TODO tiếp theo.</p><a class="back-button" href="#vocabulary">← Quay lại Từ vựng TOEIC</a></div></section>`;
}
