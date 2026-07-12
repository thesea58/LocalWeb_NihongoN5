"use strict";

const PAGE_SIZE = 100;
const FIXED_SOURCES = [
  { label: "Danh mục từ vựng", path: "/FlashCard/data/vocabulary-lists.json" },
  { label: "TOEIC 600 Essential Words", path: "/FlashCard/data/Eng-Ja-Vi/toeic_600_essential_words_en_vi.json" },
  { label: "TOEIC TSL 1-500", path: "/FlashCard/data/Eng-Ja-Vi/toeic_tsl_1_500_vocabularies_with_readings.json" },
  { label: "Danh mục bộ TOEIC", path: "/FlashCard/data/Eng-Ja-Vi/toeic_datasets.json" },
  { label: "Bảng thuật ngữ TOEIC", path: "/FlashCard/data/Eng-Ja-Vi/toeic_vietnamese_english_glossary.json" },
  { label: "Kanji N5", path: "/FlashCard/data/kanji-n5-jlpt-2010-2025.json" },
  { label: "Kanji N5 - đáp án", path: "/FlashCard/data/kanji-n5-jlpt-2010-2025_AnsFake.json" },
  { label: "Động từ N5", path: "/FlashCard/data/verbs-basic.json" },
  { label: "Chia động từ N5", path: "/FlashCard/data/verbs-conjugation-n5.json" },
  { label: "Tính từ i", path: "/FlashCard/data/adjectives-n5.json" },
  { label: "Tính từ na", path: "/FlashCard/data/adjectives-na.json" },
  ...Array.from({ length: 16 }, (_, index) => ({
    label: `Bài ${index + 10}`,
    path: `/FlashCard/data/lessons/lesson-${index + 10}.json`,
  })),
];

const elements = {
  accountStatus: document.getElementById("accountStatus"),
  logoutButton: document.getElementById("logoutButton"),
  loginPanel: document.getElementById("loginPanel"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginMessage: document.getElementById("loginMessage"),
  adminApp: document.getElementById("adminApp"),
  sourceTabs: [...document.querySelectorAll("[data-source-kind]")],
  sourceListTitle: document.getElementById("sourceListTitle"),
  sourceCount: document.getElementById("sourceCount"),
  sourceList: document.getElementById("sourceList"),
  viewerKind: document.getElementById("viewerKind"),
  viewerTitle: document.getElementById("viewerTitle"),
  viewerMeta: document.getElementById("viewerMeta"),
  viewerContent: document.getElementById("viewerContent"),
  refreshButton: document.getElementById("refreshButton"),
  tableViewButton: document.getElementById("tableViewButton"),
  jsonViewButton: document.getElementById("jsonViewButton"),
  pagination: document.getElementById("pagination"),
  previousPageButton: document.getElementById("previousPageButton"),
  nextPageButton: document.getElementById("nextPageButton"),
  pageInfo: document.getElementById("pageInfo"),
};

const state = {
  sourceKind: "fixed",
  sources: FIXED_SOURCES,
  selectedId: "",
  offset: 0,
  currentData: null,
  view: "table",
};

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `API lỗi (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setViewerMessage(message, className = "empty-message") {
  elements.viewerContent.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  elements.viewerContent.append(paragraph);
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatCell(value) {
  if (value === null || value === undefined) return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function renderSourceList() {
  elements.sourceListTitle.textContent = state.sourceKind === "fixed" ? "Tệp JSON" : "Bảng D1";
  elements.sourceCount.textContent = String(state.sources.length);
  elements.sourceList.replaceChildren();
  state.sources.forEach((source) => {
    const id = state.sourceKind === "fixed" ? source.path : source.id;
    const button = document.createElement("button");
    button.className = "source-item";
    button.type = "button";
    button.classList.toggle("is-active", id === state.selectedId);
    const label = document.createElement("strong");
    label.textContent = source.label;
    const detail = document.createElement("span");
    detail.textContent = state.sourceKind === "fixed" ? source.path : `${source.count} bản ghi`;
    button.append(label, detail);
    button.addEventListener("click", () => selectSource(id));
    elements.sourceList.append(button);
  });
}

function renderFixedJson(data, source) {
  elements.viewerKind.textContent = "JSON cố định";
  elements.viewerTitle.textContent = source.label;
  elements.viewerMeta.textContent = source.path;
  elements.viewerContent.replaceChildren();
  const pre = document.createElement("pre");
  pre.className = "json-viewer";
  pre.textContent = prettyJson(data);
  elements.viewerContent.append(pre);
  elements.tableViewButton.hidden = true;
  elements.jsonViewButton.hidden = true;
  elements.pagination.hidden = true;
}

function renderD1Data(data) {
  elements.viewerKind.textContent = "Cloudflare D1";
  elements.viewerTitle.textContent = data.table.label;
  elements.viewerMeta.textContent = `${data.total} bản ghi · hiển thị ${data.rows.length} bản ghi`;
  elements.tableViewButton.hidden = false;
  elements.jsonViewButton.hidden = false;
  elements.tableViewButton.classList.toggle("is-active", state.view === "table");
  elements.jsonViewButton.classList.toggle("is-active", state.view === "json");
  elements.viewerContent.replaceChildren();

  if (state.view === "json") {
    const pre = document.createElement("pre");
    pre.className = "json-viewer";
    pre.textContent = prettyJson(data);
    elements.viewerContent.append(pre);
  } else if (!data.rows.length) {
    setViewerMessage("Bảng này chưa có bản ghi.");
  } else {
    const columns = [...new Set(data.rows.flatMap((row) => Object.keys(row)))];
    const table = document.createElement("table");
    table.className = "data-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((column) => {
      const cell = document.createElement("th");
      cell.textContent = column;
      headRow.append(cell);
    });
    head.append(headRow);
    const body = document.createElement("tbody");
    data.rows.forEach((row) => {
      const tableRow = document.createElement("tr");
      columns.forEach((column) => {
        const cell = document.createElement("td");
        cell.textContent = formatCell(row[column]);
        tableRow.append(cell);
      });
      body.append(tableRow);
    });
    table.append(head, body);
    elements.viewerContent.append(table);
  }

  elements.pagination.hidden = false;
  const start = data.total ? data.offset + 1 : 0;
  const end = Math.min(data.offset + data.rows.length, data.total);
  elements.pageInfo.textContent = `${start}-${end} / ${data.total}`;
  elements.previousPageButton.disabled = data.offset === 0;
  elements.nextPageButton.disabled = data.offset + data.rows.length >= data.total;
}

async function selectSource(id) {
  state.selectedId = id;
  state.offset = 0;
  renderSourceList();
  await refreshCurrentSource();
}

async function refreshCurrentSource() {
  if (!state.selectedId) return;
  elements.refreshButton.disabled = true;
  setViewerMessage("Đang tải dữ liệu...");
  try {
    if (state.sourceKind === "fixed") {
      const source = FIXED_SOURCES.find((item) => item.path === state.selectedId);
      const response = await fetch(source.path, { cache: "no-store" });
      if (!response.ok) throw new Error(`Không tải được tệp (${response.status}).`);
      const data = await response.json();
      state.currentData = data;
      renderFixedJson(data, source);
    } else {
      const data = await api(`/admin/data?table=${encodeURIComponent(state.selectedId)}&limit=${PAGE_SIZE}&offset=${state.offset}`);
      state.currentData = data;
      renderD1Data(data);
    }
  } catch (error) {
    setViewerMessage(error.message, "error-message");
    elements.pagination.hidden = true;
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function switchSourceKind(kind) {
  state.sourceKind = kind;
  state.selectedId = "";
  state.currentData = null;
  elements.sourceTabs.forEach((button) => button.classList.toggle("is-active", button.dataset.sourceKind === kind));
  if (kind === "d1") {
    const summary = await api("/admin/summary");
    state.sources = summary.tables || [];
  } else {
    state.sources = FIXED_SOURCES;
  }
  renderSourceList();
  setViewerMessage("Chọn một nguồn dữ liệu để xem nội dung.");
  elements.refreshButton.disabled = true;
  elements.tableViewButton.hidden = true;
  elements.jsonViewButton.hidden = true;
  elements.pagination.hidden = true;
}

function showAdmin(user) {
  elements.accountStatus.textContent = `${user.displayName || user.username} · Admin`;
  elements.loginPanel.hidden = true;
  elements.adminApp.hidden = false;
  elements.logoutButton.hidden = false;
  switchSourceKind("fixed");
}

function showLogin(message = "") {
  elements.accountStatus.textContent = "Đăng nhập để xem dữ liệu D1";
  elements.loginPanel.hidden = false;
  elements.adminApp.hidden = true;
  elements.logoutButton.hidden = true;
  elements.loginMessage.textContent = message;
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.loginMessage.textContent = "Đang đăng nhập...";
  try {
    const payload = await api("/login", {
      method: "POST",
      body: JSON.stringify({ username: elements.usernameInput.value, password: elements.passwordInput.value }),
    });
    elements.passwordInput.value = "";
    if (!payload.user?.isAdmin) return showLogin("Tài khoản này không có quyền quản trị.");
    showAdmin(payload.user);
  } catch (error) {
    elements.loginMessage.textContent = error.message;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/logout", { method: "POST", body: "{}" }).catch(() => {});
  showLogin();
});

elements.sourceTabs.forEach((button) => {
  button.addEventListener("click", () => switchSourceKind(button.dataset.sourceKind).catch((error) => setViewerMessage(error.message, "error-message")));
});
elements.refreshButton.addEventListener("click", refreshCurrentSource);
elements.tableViewButton.addEventListener("click", () => { state.view = "table"; renderD1Data(state.currentData); });
elements.jsonViewButton.addEventListener("click", () => { state.view = "json"; renderD1Data(state.currentData); });
elements.previousPageButton.addEventListener("click", () => { state.offset = Math.max(0, state.offset - PAGE_SIZE); refreshCurrentSource(); });
elements.nextPageButton.addEventListener("click", () => { state.offset += PAGE_SIZE; refreshCurrentSource(); });

(async () => {
  try {
    const payload = await api("/session");
    if (!payload.user?.isAdmin) return showLogin("Tài khoản này không có quyền quản trị.");
    showAdmin(payload.user);
  } catch {
    showLogin();
  }
})();
