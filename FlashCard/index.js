const app = {
  lists: [],
  data: [],
  dataCache: new Map(),
  pendingData: new Map(),
  loadedIndex: [],
  from: 0,
  to: 0,
  currentIndex: -1,
  activeListId: null,

  getElement: (selector) => document.querySelector(selector),

  setStatus: (message = "", type = "") => {
    const status = app.getElement(".app-status");
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = `app-status${type ? ` app-status--${type}` : ""}`;
  },

  showElement: (selector) => {
    app.getElement(selector)?.classList.remove("hide");
  },

  hideElement: (selector) => {
    app.getElement(selector)?.classList.add("hide");
  },

  fetchJson: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Không thể tải ${url} (${response.status}).`);
    }

    return response.json();
  },

  validateVocabularyData: (data, listName) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Danh sách "${listName}" không có dữ liệu.`);
    }

    const invalidIndex = data.findIndex(
      (word) =>
        !word ||
        typeof word.kanji !== "string" ||
        typeof word.hira !== "string" ||
        typeof word.meaning !== "string",
    );

    if (invalidIndex !== -1) {
      throw new Error(
        `Từ vựng số ${invalidIndex + 1} trong "${listName}" không hợp lệ.`,
      );
    }

    return data;
  },

  loadVocabularyData: async (list) => {
    if (app.dataCache.has(list.id)) {
      return app.dataCache.get(list.id);
    }

    if (app.pendingData.has(list.id)) {
      return app.pendingData.get(list.id);
    }

    const request = app
      .fetchJson(list.file)
      .then((data) => app.validateVocabularyData(data, list.name))
      .then((data) => {
        app.dataCache.set(list.id, data);
        return data;
      })
      .finally(() => {
        app.pendingData.delete(list.id);
      });

    app.pendingData.set(list.id, request);
    return request;
  },

  getListDetails: (listId) =>
    [...document.querySelectorAll(".vocabulary-group")].find(
      (details) => details.dataset.listId === listId,
    ),

  createVocabularyItem: (word, index, list) => {
    const item = document.createElement("li");
    item.className = "vocabulary-word";
    item.setAttribute("role", "none");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "vocabulary-word-button";
    button.dataset.wordIndex = String(index);
    button.setAttribute("role", "treeitem");

    const title = document.createElement("span");
    title.className = "vocabulary-word-title";
    title.textContent = `${index + 1}. ${word.kanji}`;

    const detail = document.createElement("span");
    detail.className = "vocabulary-word-detail";
    detail.textContent = [word.hira, word.wordType, word.meaning]
      .filter(Boolean)
      .join(" — ");

    button.append(title, detail);
    button.addEventListener("click", () => {
      void app.activateList(list.id, index);
    });
    item.append(button);
    return item;
  },

  populateVocabularyGroup: (list, data) => {
    const details = app.getListDetails(list.id);
    const words = details?.querySelector(".vocabulary-words");
    if (!words) {
      return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach((word, index) => {
      fragment.append(app.createVocabularyItem(word, index, list));
    });

    words.replaceChildren(fragment);
    details.dataset.loaded = "true";
    app.updateTreeSelection();
  },

  loadVocabularyGroup: async (list) => {
    const details = app.getListDetails(list.id);
    const words = details?.querySelector(".vocabulary-words");
    if (!details || !words || details.dataset.loaded === "true") {
      return;
    }

    words.innerHTML = '<li class="tree-status">Đang tải từ vựng...</li>';

    try {
      const data = await app.loadVocabularyData(list);
      const count = details.querySelector(".vocabulary-count");
      if (count) {
        count.textContent = `${data.length} từ`;
      }
      app.populateVocabularyGroup(list, data);
    } catch (error) {
      words.innerHTML = "";
      const errorItem = document.createElement("li");
      errorItem.className = "tree-status tree-status--error";
      errorItem.textContent = error.message;
      words.append(errorItem);
    }
  },

  createVocabularyGroup: (list) => {
    const details = document.createElement("details");
    details.className = "vocabulary-group";
    details.dataset.listId = list.id;
    details.setAttribute("role", "treeitem");

    const summary = document.createElement("summary");
    summary.className = "vocabulary-summary";

    const summaryName = document.createElement("span");
    summaryName.className = "vocabulary-list-name";
    summaryName.textContent = list.name;

    const count = document.createElement("span");
    count.className = "vocabulary-count";
    count.textContent = `${list.count} từ`;
    summary.append(summaryName, count);

    const description = document.createElement("p");
    description.className = "vocabulary-description";
    description.textContent = list.description;

    const studyButton = document.createElement("button");
    studyButton.type = "button";
    studyButton.className = "study-list-button";
    studyButton.textContent = "Học danh sách này";
    studyButton.addEventListener("click", () => {
      void app.activateList(list.id);
    });

    const words = document.createElement("ul");
    words.className = "vocabulary-words";
    words.setAttribute("role", "group");

    details.append(summary, description, studyButton, words);
    details.addEventListener("toggle", () => {
      if (details.open) {
        void app.loadVocabularyGroup(list);
      }
    });

    return details;
  },

  renderVocabularyTree: () => {
    const tree = app.getElement("#vocabulary-tree");
    if (!tree) {
      return;
    }

    const fragment = document.createDocumentFragment();
    app.lists.forEach((list) => {
      fragment.append(app.createVocabularyGroup(list));
    });
    tree.replaceChildren(fragment);
  },

  updateTreeSelection: () => {
    document.querySelectorAll(".vocabulary-group").forEach((details) => {
      const isActive = details.dataset.listId === app.activeListId;
      details.classList.toggle("is-active", isActive);

      const studyButton = details.querySelector(".study-list-button");
      if (studyButton) {
        studyButton.textContent = isActive
          ? "Đang học danh sách này"
          : "Học danh sách này";
        studyButton.setAttribute("aria-pressed", String(isActive));
      }

      details.querySelectorAll(".vocabulary-word-button").forEach((button) => {
        const isCurrent =
          isActive && Number(button.dataset.wordIndex) === app.currentIndex;
        button.classList.toggle("is-current", isCurrent);
        if (isCurrent) {
          button.setAttribute("aria-current", "true");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    });
  },

  resetAnswerInput: () => {
    const input = app.getElement(".inputResult");
    if (input) {
      input.value = "";
      input.style.outlineColor = "blue";
    }
  },

  showCard: (index) => {
    const word = app.data[index];
    const name = app.getElement(".name");
    const meaning = app.getElement(".meaning");
    const indexElement = app.getElement(".index");
    if (!word || !name || !meaning) {
      return;
    }

    app.currentIndex = index;
    if (!app.loadedIndex.includes(index)) {
      app.loadedIndex.push(index);
    }

    name.textContent = word.kanji;
    meaning.textContent = `${word.hira} — ${word.meaning}`;
    if (indexElement) {
      indexElement.textContent = `Index: ${index + 1} / ${app.data.length}`;
    }

    app.hideElement(".meaning");
    app.resetAnswerInput();
    app.setStatus("");
    app.updateTreeSelection();
  },

  randomData: () => {
    if (!app.data.length || app.from >= app.to) {
      return;
    }

    let available = [];
    for (let index = app.from; index < app.to; index += 1) {
      if (!app.loadedIndex.includes(index)) {
        available.push(index);
      }
    }

    if (!available.length) {
      app.loadedIndex = [];
      for (let index = app.from; index < app.to; index += 1) {
        available.push(index);
      }
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    app.showCard(available[randomIndex]);
  },

  updateRangeInputs: () => {
    const fromInput = app.getElement("#from");
    const toInput = app.getElement("#to");
    if (!fromInput || !toInput) {
      return;
    }

    fromInput.max = String(app.data.length);
    toInput.max = String(app.data.length);
    fromInput.value = "1";
    toInput.value = String(app.data.length);
  },

  activateList: async (listId, selectedIndex = null) => {
    const list = app.lists.find((item) => item.id === listId);
    if (!list) {
      return;
    }

    app.setStatus(`Đang tải ${list.name}...`);

    try {
      const data = await app.loadVocabularyData(list);
      app.data = data;
      app.activeListId = list.id;
      app.loadedIndex = [];
      app.from = 0;
      app.to = data.length;
      app.updateRangeInputs();

      const activeListName = app.getElement("#active-list-name");
      if (activeListName) {
        activeListName.textContent = list.name;
      }

      const details = app.getListDetails(list.id);
      if (details?.open) {
        app.populateVocabularyGroup(list, data);
      }

      if (
        Number.isInteger(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < data.length
      ) {
        app.showCard(selectedIndex);
      } else {
        app.randomData();
      }
      app.updateTreeSelection();
    } catch (error) {
      app.showLoadError(error);
    }
  },

  showLoadError: (error) => {
    const name = app.getElement(".name");
    const tree = app.getElement("#vocabulary-tree");
    const message =
      `${error.message} Hãy mở ứng dụng qua web server, ` +
      "ví dụ: python -m http.server.";

    if (name) {
      name.textContent = "Không tải được dữ liệu";
    }
    if (tree) {
      tree.innerHTML = "";
      const status = document.createElement("p");
      status.className = "tree-status tree-status--error";
      status.textContent = message;
      tree.append(status);
    }
    app.setStatus(message, "error");
  },

  initializeVocabularyLists: async () => {
    try {
      const lists = await app.fetchJson("./data/vocabulary-lists.json");
      if (!Array.isArray(lists) || !lists.length) {
        throw new Error("Danh mục từ vựng không hợp lệ.");
      }

      app.lists = lists;
      app.renderVocabularyTree();

      const defaultListId = document.body.dataset.defaultList;
      const defaultList =
        lists.find((list) => list.id === defaultListId) || lists[0];
      await app.activateList(defaultList.id);
    } catch (error) {
      app.showLoadError(error);
    }
  },

  onShowClick: () => {
    app.getElement(".button-show")?.addEventListener("click", () => {
      app.showElement(".meaning");
    });
  },

  onNextClick: () => {
    app.getElement(".button-next")?.addEventListener("click", () => {
      app.hideElement(".meaning");
      app.randomData();
    });
  },

  onSubmitClick: () => {
    const submitButton = app.getElement(".button-submit");
    const fromInput = app.getElement("#from");
    const toInput = app.getElement("#to");
    if (!submitButton || !fromInput || !toInput) {
      return;
    }

    submitButton.addEventListener("click", () => {
      const from = Number(fromInput.value);
      const to = Number(toInput.value);
      const isInvalid =
        !Number.isInteger(from) ||
        !Number.isInteger(to) ||
        from < 1 ||
        to > app.data.length ||
        from > to;

      if (isInvalid) {
        app.setStatus(
          `Khoảng hợp lệ là từ 1 đến ${app.data.length}.`,
          "error",
        );
        return;
      }

      app.from = from - 1;
      app.to = to;
      app.loadedIndex = [];
      app.setStatus(`Đã áp dụng khoảng ${from}–${to}.`, "success");
      app.randomData();
    });
  },

  onCheckClick: () => {
    const checkButton = app.getElement(".button-check");
    const input = app.getElement(".inputResult");
    if (!checkButton || !input) {
      return;
    }

    checkButton.addEventListener("click", () => {
      const answer = input.value.trim().normalize("NFKC");
      if (!answer || app.currentIndex < 0) {
        return;
      }

      const correctAnswer = app.data[app.currentIndex].hira
        .trim()
        .normalize("NFKC");
      if (answer === correctAnswer) {
        input.style.outlineColor = "green";
        app.showElement(".meaning");
        app.setStatus("Chính xác!", "success");
      } else {
        input.style.outlineColor = "red";
        app.setStatus("Chưa đúng, hãy thử lại.", "error");
      }
    });
  },

  onFormCheckSubmit: () => {
    app.getElement("#fCheck")?.addEventListener("submit", (event) => {
      event.preventDefault();
    });
  },

  run: () => {
    app.onShowClick();
    app.onNextClick();
    app.onSubmitClick();
    app.onCheckClick();
    app.onFormCheckSubmit();
    void app.initializeVocabularyLists();
  },
};

app.run();
