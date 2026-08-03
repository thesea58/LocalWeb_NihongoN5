import { courseChapters } from "../config/course.js";

export function createCourseShell(target) {
  const shell = document.createElement("div");
  shell.className = "course-shell";
  shell.innerHTML = `
    <header class="app-header">
      <a class="brand" href="/" aria-label="Về trang chủ"><span class="brand-mark">V</span> Vocab Studio</a>
      <button class="menu-button" type="button" aria-controls="courseSidebar" aria-expanded="false"><span aria-hidden="true">☰</span> Nội dung <b>16</b></button>
      <a class="home-link" href="/">Trang chủ</a>
    </header>
    <div class="course-layout">
      <aside id="courseSidebar" class="course-sidebar" aria-label="Nội dung khóa học">
        <div class="sidebar-heading"><p class="eyebrow">Khóa học</p><h2>Complete TOEIC</h2></div>
        <nav class="course-menu" aria-label="Các chương học">
          ${courseChapters.map((chapter) => `<a data-chapter="${chapter.id}" href="#${chapter.id}"><span class="menu-icon">${chapter.icon}</span>${chapter.label}</a>`).join("")}
        </nav>
        <div class="sidebar-footer"><p>Không gian học cá nhân</p><a href="#flashcard-review">Ôn tập Flashcards</a><a href="#renew">Gia hạn tài khoản</a></div>
      </aside>
      <div class="sidebar-backdrop" hidden></div>
      <main class="course-main" id="courseContent"></main>
    </div>
    <button class="scroll-top-button" type="button" aria-label="Cuộn lên đầu trang" title="Lên đầu trang" hidden>↑</button>
  `;
  target.replaceChildren(shell);

  const sidebar = shell.querySelector(".course-sidebar");
  const backdrop = shell.querySelector(".sidebar-backdrop");
  const menuButton = shell.querySelector(".menu-button");
  const scrollTopButton = shell.querySelector(".scroll-top-button");
  const setMenu = (open) => {
    sidebar.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    menuButton.setAttribute("aria-expanded", String(open));
  };
  menuButton.addEventListener("click", () => setMenu(!sidebar.classList.contains("is-open")));
  backdrop.addEventListener("click", () => setMenu(false));
  const updateScrollTopVisibility = () => { scrollTopButton.hidden = window.scrollY < 360; };
  window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
  scrollTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  updateScrollTopVisibility();

  return {
    content: shell.querySelector("#courseContent"),
    closeMenu: () => setMenu(false),
    setActiveChapter: (chapterId) => {
      shell.querySelectorAll("[data-chapter]").forEach((link) => link.classList.toggle("is-active", link.dataset.chapter === chapterId));
    },
  };
}
