import { createCourseShell } from "./components/course-shell.js";
import { grammarLessonTitle, isAvailable, parseRoute } from "./config/course.js";
import { renderCourseOverview } from "./pages/course-overview.js";
import { renderFlashcards } from "./pages/flashcards.js";
import { renderGrammarBasics } from "./pages/grammar-basics.js";
import { renderGrammarOverview } from "./pages/grammar-overview.js";
import { renderImportedLesson } from "./pages/imported-lesson.js";
import { renderPracticeSession } from "./pages/practice-session.js?build=practice-source-v3";
import { renderTodoPage } from "./pages/todo-page.js";

const shell = createCourseShell(document.querySelector("#app"));

async function renderRoute() {
  const route = parseRoute();
  shell.closeMenu();
  shell.setActiveChapter(route.chapter);
  if (route.chapter === "vocabulary" && !route.list) {
    document.title = "Từ vựng TOEIC | Vocab Studio";
    renderCourseOverview(shell.content);
    return;
  }
  if (route.chapter === "grammar" && !route.list) {
    document.title = "Ngữ pháp TOEIC | Vocab Studio";
    renderGrammarOverview(shell.content);
    return;
  }
  if (route.chapter === "grammar" && route.list === "basics-1" && !route.activity) {
    document.title = "Kiến thức cơ bản 1 | Vocab Studio";
    await renderGrammarBasics(shell.content);
    return;
  }
  if (route.chapter === "grammar" && route.list === "basics-2" && !route.activity) {
    document.title = "Kiến thức cơ bản 2 | Vocab Studio";
    await renderImportedLesson(shell.content, {
      title: "Kiến thức cơ bản 2: mệnh đề và câu",
      asset: "../../assets/content/grammar-basics-2.html",
      nextRoute: "#grammar/nouns",
      nextTitle: "Bài tiếp theo: Danh từ",
    });
    return;
  }
  if (route.chapter === "grammar" && route.list === "nouns" && route.activity === "theory-1") {
    document.title = "Danh từ · Phần 1 | Vocab Studio";
    await renderImportedLesson(shell.content, {
      title: "Danh từ: lý thuyết phần 1",
      asset: "../../assets/content/grammar-nouns-1.html",
      nextRoute: "#grammar/nouns/theory-2",
      nextTitle: "Bài tiếp theo: Danh từ · Phần 2",
      eyebrow: "Bài giảng · Danh từ",
    });
    return;
  }
  if (route.chapter === "grammar" && route.list === "nouns" && route.activity === "theory-2") {
    document.title = "Danh từ · Phần 2 | Vocab Studio";
    await renderImportedLesson(shell.content, {
      title: "Danh từ: lý thuyết phần 2",
      asset: "../../assets/content/grammar-nouns-2.html",
      nextRoute: "#grammar/pronouns/theory",
      nextTitle: "Bài tiếp theo: Đại từ",
      eyebrow: "Bài giảng · Danh từ",
    });
    return;
  }
  if (route.chapter === "grammar" && route.list === "nouns" && route.activity === "quiz") {
    document.title = "Luyện tập Danh từ | Vocab Studio";
    await renderPracticeSession(shell.content, {
      lessonTitle: grammarLessonTitle("nouns"),
      practiceTitle: "Trắc nghiệm format TOEIC",
    });
    return;
  }
  if (isAvailable(route)) {
    document.title = "List 20 · Flashcards | Vocab Studio";
    await renderFlashcards(shell.content);
    return;
  }
  document.title = "TODO | Complete TOEIC";
  renderTodoPage(shell.content, route);
}

window.addEventListener("hashchange", renderRoute);
renderRoute();
