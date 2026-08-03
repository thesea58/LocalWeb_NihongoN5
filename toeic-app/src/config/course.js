export const courseChapters = [
  { id: "vocabulary", label: "Từ vựng TOEIC", icon: "▤" },
  { id: "grammar", label: "Ngữ pháp TOEIC", icon: "⌁" },
  { id: "part-1", label: "Part 1: Photographs - Nghe tranh", icon: "01" },
  { id: "part-2", label: "Part 2: Question - Response - Hỏi - đáp", icon: "02" },
  { id: "part-3", label: "Part 3: Conversations - Nghe hiểu đối thoại", icon: "03" },
  { id: "part-4", label: "Part 4: Talks - Nghe hiểu bài nói", icon: "04" },
  { id: "part-5", label: "Part 5: Incomplete Sentences - Điền từ vào câu", icon: "05" },
  { id: "part-6", label: "Part 6: Text Completion - Điền từ vào đoạn văn", icon: "06" },
  { id: "part-7", label: "Part 7: Reading Comprehension - Đọc hiểu văn bản", icon: "07" },
  { id: "dictation", label: "Luyện nghe chép chính tả TOEIC", icon: "♫" },
];

export const activities = [
  { id: "flashcards", group: "Từ vựng", label: "Flashcards", icon: "▤" },
  { id: "quiz", group: "Luyện tập", label: "Trắc nghiệm từ vựng", icon: "✓" },
  { id: "pairs", group: "Luyện tập", label: "Tìm cặp", icon: "⌘" },
  { id: "listening", group: "Luyện tập", label: "Nghe từ vựng", icon: "♫" },
  { id: "translation", group: "Luyện tập", label: "Dịch nghĩa / Điền từ", icon: "↔" },
  { id: "dictation", group: "Luyện tập", label: "Nghe chính tả", icon: "✎" },
];

export const grammarLessons = [
  { id: "basics-1", title: "Kiến thức cơ bản 1: từ loại và cụm từ", status: "ready", type: "Bài học" },
  { id: "basics-2", title: "Kiến thức cơ bản 2: mệnh đề và câu", status: "ready", type: "Bài học" },
  { id: "nouns", title: "Danh từ", status: "todo", type: "Chủ điểm" },
  { id: "pronouns", title: "Đại từ", status: "todo", type: "Chủ điểm" },
  { id: "adjectives", title: "Tính từ", status: "todo", type: "Chủ điểm" },
  { id: "tenses", title: "Thì", status: "todo", type: "Chủ điểm" },
  { id: "voice", title: "Thể chủ động và bị động", status: "todo", type: "Chủ điểm" },
  { id: "verb-forms", title: "Dạng động từ", status: "todo", type: "Chủ điểm" },
  { id: "adverbs", title: "Trạng từ", status: "todo", type: "Chủ điểm" },
  { id: "prepositions", title: "Giới từ", status: "todo", type: "Chủ điểm" },
  { id: "conditionals", title: "Câu điều kiện", status: "todo", type: "Chủ điểm" },
  { id: "comparison", title: "Cấu trúc so sánh", status: "todo", type: "Chủ điểm" },
];

export const grammarActivities = [
  { id: "theory", group: "Bài giảng", label: "Lý thuyết", icon: "▷" },
  { id: "quiz", group: "Luyện tập", label: "Trắc nghiệm format TOEIC", icon: "✎" },
  { id: "practice", group: "Luyện tập", label: "Bài tập theo chủ điểm", icon: "✦" },
];

export function grammarActivitiesFor(lesson) {
  if (lesson.id !== "nouns") return grammarActivities;
  return [
    { id: "theory-1", group: "Bài giảng", label: "Lý thuyết (phần 1)", icon: "▷" },
    { id: "theory-2", group: "Bài giảng", label: "Lý thuyết (phần 2)", icon: "▷" },
    ...grammarActivities.filter((activity) => activity.id !== "theory"),
  ];
}

export function parseRoute() {
  const [chapter = "vocabulary", list, activity] = window.location.hash.slice(1).split("/").filter(Boolean);
  return { chapter, list, activity };
}

export function isAvailable(route) {
  return route.chapter === "vocabulary" && route.list === "list-20" && route.activity === "flashcards";
}

export function chapterLabel(id) {
  return courseChapters.find((chapter) => chapter.id === id)?.label || "Trang học";
}

export function grammarLessonTitle(id) {
  return grammarLessons.find((lesson) => lesson.id === id)?.title || "Bài ngữ pháp";
}
