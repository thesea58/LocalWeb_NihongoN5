import { activities } from "../config/course.js";
import { activityLink } from "../components/activity-link.js";
import { normalizeText } from "../utils/text.js";

function activityCard(listNumber, activity) {
  const route = `#vocabulary/list-${listNumber}/${activity.id}`;
  const ready = listNumber === 20 && activity.id === "flashcards";
  return activityLink({ href: route, icon: activity.icon, title: `${activity.group}: ${activity.label}`, detail: ready ? "Đã có nội dung" : "TODO", ready });
}

export function renderCourseOverview(container) {
  container.innerHTML = `
    <nav class="breadcrumbs" aria-label="Điều hướng vị trí"><a href="#vocabulary">Complete TOEIC</a><span>/</span><span>Từ vựng TOEIC</span></nav>
    <div class="course-title-row"><div><p class="eyebrow">Chương học</p><h1>Từ vựng TOEIC</h1></div><section class="progress-card" aria-label="Tiến độ học tập"><strong class="progress-number">0%</strong><div><span class="progress-label">Tiến độ học tập</span><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></div></section></div>
    <form class="lesson-search"><input type="search" placeholder="Nhập từ khoá bạn muốn tìm ..." aria-label="Tìm bài học"><button type="submit">Tìm kiếm</button></form>
    <div class="lesson-collection"></div>
  `;
  const input = container.querySelector("input");
  const host = container.querySelector(".lesson-collection");
  const draw = () => {
    const query = normalizeText(input.value.trim());
    const matches = Array.from({ length: 20 }, (_, index) => index + 1).filter((number) => !query || `list ${number}`.includes(query) || activities.some((activity) => normalizeText(`${activity.group} ${activity.label}`).includes(query)));
    host.innerHTML = matches.length ? matches.map((number) => `<section class="lesson-block"><h2>List ${number}</h2><div class="activity-grid">${activities.map((activity) => activityCard(number, activity)).join("")}</div></section>`).join("") : '<div class="empty-search">Không tìm thấy bài học phù hợp.</div>';
  };
  container.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); draw(); });
  input.addEventListener("input", draw);
  draw();
}
