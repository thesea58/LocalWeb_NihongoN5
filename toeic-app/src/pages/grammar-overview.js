import { activityLink } from "../components/activity-link.js";
import { grammarActivitiesFor, grammarLessons } from "../config/course.js";
import { normalizeText } from "../utils/text.js";

function grammarActivityCard(lesson, activity) {
  const ready = (lesson.status === "ready" && activity.id === "theory") || (lesson.id === "nouns" && (activity.id.startsWith("theory-") || activity.id === "quiz"));
  const route = activity.id === "theory" && ready ? `#grammar/${lesson.id}` : `#grammar/${lesson.id}/${activity.id}`;
  return activityLink({
    href: route,
    icon: activity.icon,
    title: `${activity.group}: ${activity.label}`,
    detail: ready ? "Đã có nội dung" : "TODO",
    ready,
  });
}

export function renderGrammarOverview(container) {
  container.innerHTML = `
    <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><span>Ngữ pháp TOEIC</span></nav>
    <div class="course-title-row"><div><p class="eyebrow">Chương học</p><h1>Ngữ pháp TOEIC</h1><p class="hero-copy">Học hệ thống từ loại, cấu trúc câu và các điểm ngữ pháp thường gặp trong bài thi TOEIC.</p></div><section class="progress-card" aria-label="Tiến độ học tập"><strong class="progress-number">0%</strong><div><span class="progress-label">Tiến độ học tập</span><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div></section></div>
    <form class="lesson-search"><input type="search" placeholder="Nhập từ khoá bạn muốn tìm ..." aria-label="Tìm bài ngữ pháp"><button type="submit">Tìm kiếm</button></form>
    <div class="grammar-lesson-collection"></div>
  `;
  const input = container.querySelector("input");
  const host = container.querySelector(".grammar-lesson-collection");
  const draw = () => {
    const query = normalizeText(input.value.trim());
    const topics = grammarLessons.filter((lesson) => !query || normalizeText(`${lesson.type} ${lesson.title} ${grammarActivitiesFor(lesson).map((activity) => `${activity.group} ${activity.label}`).join(" ")}`).includes(query));
    host.innerHTML = topics.length ? topics.map((lesson) => `<section class="lesson-block grammar-lesson-block"><h2>${lesson.title}</h2><div class="activity-grid grammar-activity-grid">${grammarActivitiesFor(lesson).map((activity) => grammarActivityCard(lesson, activity)).join("")}</div></section>`).join("") : '<div class="empty-search">Không tìm thấy chủ điểm phù hợp.</div>';
  };
  container.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); draw(); });
  input.addEventListener("input", draw);
  draw();
}
