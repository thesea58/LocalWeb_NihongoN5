const hiraganaPractice = {
  lists: [],
  dataCache: new Map(),
  selectedMode: "multiple-choice",
  currentChallenge: null,
  lastChallengeType: null,
  challengeUsage: new Map(),
  activeList: null,
  sourceData: [],
  questions: [],
  questionIndex: 0,
  score: 0,
  answered: false,
  results: [],
  availableTokens: [],
  selectedTokens: [],
  answerTokenCount: 0,

  hiraganaPool: Array.from(
    "あいうえおかきくけこさしすせそたちつてとなにぬねの" +
      "はひふへほまみむめもやゆよらりるれろわをん" +
      "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ" +
      "ぁぃぅぇぉゃゅょっゔ",
  ),

  katakanaPool: Array.from(
    "アイウエオカキクケコサシスセソタチツテトナニヌネノ" +
      "ハヒフヘホマミムメモヤユヨラリルレロワヲン" +
      "ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ" +
      "ァィゥェォャュョッヴヵヶ",
  ),

  get: (selector) => document.querySelector(selector),

  shuffle: (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  },

  getExerciseReading: (reading) => {
    return String(reading)
      .normalize("NFKC")
      .replace(/\[[^\]]*]/g, "")
      .replace(/[~〜]/g, "")
      .replace(/\s+/g, "");
  },

  getKanaType: (reading) => {
    const hasHiragana = /[\u3041-\u3096\u309d-\u309f]/u.test(reading);
    const hasKatakana = /[\u30a1-\u30fa\u30fd-\u30ff]/u.test(reading);
    if (hasKatakana && !hasHiragana) {
      return "Katakana";
    }
    if (hasKatakana && hasHiragana) {
      return "Kana hỗn hợp";
    }
    return "Hiragana";
  },

  getDistractorPool: (reading) => {
    const kanaType = hiraganaPractice.getKanaType(reading);
    if (kanaType === "Katakana") {
      return hiraganaPractice.katakanaPool;
    }
    if (kanaType === "Kana hỗn hợp") {
      return [
        ...new Set([
          ...hiraganaPractice.hiraganaPool,
          ...hiraganaPractice.katakanaPool,
        ]),
      ];
    }
    return hiraganaPractice.hiraganaPool;
  },

  splitReading: (reading) => {
    if ("Segmenter" in Intl) {
      const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
      return [...segmenter.segment(reading)].map((item) => item.segment);
    }
    return Array.from(reading);
  },

  fetchJson: async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Không thể tải ${url} (${response.status}).`);
    }
    return response.json();
  },

  loadListData: async (list) => {
    if (hiraganaPractice.dataCache.has(list.id)) {
      return hiraganaPractice.dataCache.get(list.id);
    }

    const data = await hiraganaPractice.fetchJson(list.file);
    if (!Array.isArray(data) || !data.length) {
      throw new Error(`Danh sách "${list.name}" không có dữ liệu.`);
    }

    const validData = data.filter(
      (word) =>
        word &&
        typeof word.kanji === "string" &&
        typeof word.hira === "string" &&
        typeof word.meaning === "string",
    );
    if (!validData.length) {
      throw new Error(`Danh sách "${list.name}" không có từ hợp lệ.`);
    }

    hiraganaPractice.dataCache.set(list.id, validData);
    return validData;
  },

  createListOption: (list) => {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = `${list.name} (${list.count} từ)`;
    return option;
  },

  populateListSelect: () => {
    const select = hiraganaPractice.get("#list-select");
    if (!select) {
      return;
    }

    const generalGroup = document.createElement("optgroup");
    generalGroup.label = "Danh sách tổng hợp";
    const lessonGroup = document.createElement("optgroup");
    lessonGroup.label = "Minna no Nihongo I";

    hiraganaPractice.lists.forEach((list) => {
      const option = hiraganaPractice.createListOption(list);
      if (list.id.startsWith("minna-lesson-")) {
        lessonGroup.append(option);
      } else {
        generalGroup.append(option);
      }
    });

    select.replaceChildren(generalGroup, lessonGroup);
    const preferredList = hiraganaPractice.lists.find(
      (list) => list.id === "minna-lesson-10",
    );
    select.value = preferredList?.id || hiraganaPractice.lists[0].id;
  },

  setSetupStatus: (message = "") => {
    const status = hiraganaPractice.get("#setup-status");
    if (status) {
      status.textContent = message;
    }
  },

  initialize: async () => {
    hiraganaPractice.bindEvents();
    try {
      const lists = await hiraganaPractice.fetchJson(
        "./data/vocabulary-lists.json",
      );
      if (!Array.isArray(lists) || !lists.length) {
        throw new Error("Danh mục từ vựng không hợp lệ.");
      }
      hiraganaPractice.lists = lists;
      hiraganaPractice.populateListSelect();
      hiraganaPractice.get("#start-button").disabled = false;
      hiraganaPractice.setSetupStatus("");
    } catch (error) {
      hiraganaPractice.get("#start-button").disabled = true;
      hiraganaPractice.setSetupStatus(
        `${error.message} Hãy mở trang bằng web server, ví dụ: python -m http.server.`,
      );
    }
  },

  setMode: (mode) => {
    hiraganaPractice.selectedMode = mode;
    document.querySelectorAll(".mode-card").forEach((button) => {
      const isActive = button.dataset.mode === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  },

  prepareQuestions: (data, sessionSize) => {
    const unique = new Map();
    data.forEach((word) => {
      const answer = hiraganaPractice.getExerciseReading(word.hira);
      if (!answer || hiraganaPractice.splitReading(answer).length > 24) {
        return;
      }
      const key = `${word.kanji}\u0000${answer}\u0000${word.meaning}`;
      if (!unique.has(key)) {
        unique.set(key, { ...word, answer });
      }
    });
    const questions = hiraganaPractice.shuffle([...unique.values()]);
    const limit =
      sessionSize === "all"
        ? questions.length
        : Math.min(Number(sessionSize), questions.length);
    return questions.slice(0, limit);
  },

  updateSessionSizeLabels: () => {
    const sessionSize = hiraganaPractice.get("#session-size-select").value;
    const label = sessionSize === "all" ? "Tất cả từ" : `${sessionSize} từ`;
    hiraganaPractice.get("#session-badge").textContent = `${label} / lượt`;
    hiraganaPractice.get("#start-button").textContent =
      `Bắt đầu luyện ${label.toLowerCase()}`;
  },

  startSession: async () => {
    const select = hiraganaPractice.get("#list-select");
    const list = hiraganaPractice.lists.find(
      (item) => item.id === select.value,
    );
    if (!list) {
      return;
    }

    const startButton = hiraganaPractice.get("#start-button");
    startButton.disabled = true;
    hiraganaPractice.setSetupStatus(`Đang chuẩn bị ${list.name}...`);

    try {
      const data = await hiraganaPractice.loadListData(list);
      const sessionSize = hiraganaPractice.get("#session-size-select").value;
      const questions = hiraganaPractice.prepareQuestions(data, sessionSize);
      if (!questions.length) {
        throw new Error("Danh sách này không có cách đọc phù hợp để luyện.");
      }

      hiraganaPractice.activeList = list;
      hiraganaPractice.sourceData = data;
      hiraganaPractice.questions = questions;
      hiraganaPractice.questionIndex = 0;
      hiraganaPractice.score = 0;
      hiraganaPractice.results = [];
      hiraganaPractice.currentChallenge = null;
      hiraganaPractice.lastChallengeType = null;
      hiraganaPractice.challengeUsage = new Map();
      hiraganaPractice.showPanel("exercise");

      hiraganaPractice.get("#active-list-label").textContent = list.name;
      hiraganaPractice.get("#mode-label").textContent =
        hiraganaPractice.selectedMode === "multiple-choice"
          ? "Trắc nghiệm"
          : "Ghép từ";
      hiraganaPractice.get("#score-total").textContent = String(
        questions.length,
      );
      hiraganaPractice.renderQuestion();
      hiraganaPractice.setSetupStatus("");
    } catch (error) {
      hiraganaPractice.setSetupStatus(error.message);
    } finally {
      startButton.disabled = false;
    }
  },

  showPanel: (panelName) => {
    hiraganaPractice.get("#setup-panel").hidden = panelName !== "setup";
    hiraganaPractice.get("#exercise-panel").hidden = panelName !== "exercise";
    hiraganaPractice.get("#result-panel").hidden = panelName !== "result";
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  getCurrentQuestion: () =>
    hiraganaPractice.questions[hiraganaPractice.questionIndex],

  getPrompt: (question) => {
    const kanjiReading = hiraganaPractice.getExerciseReading(question.kanji);
    const revealsAnswer = kanjiReading === question.answer;
    return revealsAnswer ? question.meaning : question.kanji;
  },

  hasUsefulKanji: (word) =>
    typeof word.kanji === "string" &&
    /[\u3400-\u9fff]/u.test(word.kanji),

  getAnswerFieldValue: (word, field) => {
    if (field === "kana") {
      return hiraganaPractice.getExerciseReading(word.hira);
    }
    if (field === "meaning") {
      return word.meaning?.trim() || "";
    }
    if (field === "kanji" && hiraganaPractice.hasUsefulKanji(word)) {
      return word.kanji.trim();
    }
    return "";
  },

  getChoiceAnswers: (challenge) => {
    const possibleAnswers = new Set();
    hiraganaPractice.sourceData.forEach((word) => {
      const answer = hiraganaPractice.getAnswerFieldValue(
        word,
        challenge.answerField,
      );
      if (answer && answer !== challenge.answer) {
        possibleAnswers.add(answer);
      }
    });

    const distractors = hiraganaPractice
      .shuffle([...possibleAnswers])
      .slice(0, 3);
    if (distractors.length < 3) {
      return [];
    }
    return hiraganaPractice.shuffle([challenge.answer, ...distractors]);
  },

  buildMultipleChoiceChallenge: (question) => {
    const definitions = [
      {
        id: "kana-to-meaning",
        direction: "Kana → Tiếng Việt",
        prompt: question.answer,
        answer: question.meaning,
        answerField: "meaning",
        answerLabel: "nghĩa tiếng Việt",
      },
      {
        id: "meaning-to-kana",
        direction: "Tiếng Việt → Kana",
        prompt: question.meaning,
        answer: question.answer,
        answerField: "kana",
        answerLabel: "cách đọc Kana",
      },
    ];

    if (hiraganaPractice.hasUsefulKanji(question)) {
      definitions.push(
        {
          id: "kanji-to-kana",
          direction: "Kanji → Kana",
          prompt: question.kanji,
          answer: question.answer,
          answerField: "kana",
          answerLabel: "cách đọc Kana",
        },
        {
          id: "kana-to-kanji",
          direction: "Kana → Kanji",
          prompt: question.answer,
          answer: question.kanji,
          answerField: "kanji",
          answerLabel: "Kanji",
        },
        {
          id: "kanji-to-meaning",
          direction: "Kanji → Tiếng Việt",
          prompt: question.kanji,
          answer: question.meaning,
          answerField: "meaning",
          answerLabel: "nghĩa tiếng Việt",
        },
        {
          id: "meaning-to-kanji",
          direction: "Tiếng Việt → Kanji",
          prompt: question.meaning,
          answer: question.kanji,
          answerField: "kanji",
          answerLabel: "Kanji",
        },
      );
    }

    const viableChallenges = definitions
      .map((definition) => ({
        ...definition,
        choices: hiraganaPractice.getChoiceAnswers(definition),
      }))
      .filter((challenge) => challenge.choices.length === 4);
    const withoutImmediateRepeat = viableChallenges.filter(
      (challenge) => challenge.id !== hiraganaPractice.lastChallengeType,
    );
    const candidates = withoutImmediateRepeat.length
      ? withoutImmediateRepeat
      : viableChallenges;
    const minimumUsage = Math.min(
      ...candidates.map(
        (challenge) => hiraganaPractice.challengeUsage.get(challenge.id) || 0,
      ),
    );
    const leastUsed = candidates.filter(
      (challenge) =>
        (hiraganaPractice.challengeUsage.get(challenge.id) || 0) ===
        minimumUsage,
    );
    const challenge =
      leastUsed[Math.floor(Math.random() * leastUsed.length)] || candidates[0];

    hiraganaPractice.lastChallengeType = challenge.id;
    hiraganaPractice.challengeUsage.set(
      challenge.id,
      (hiraganaPractice.challengeUsage.get(challenge.id) || 0) + 1,
    );
    return challenge;
  },

  renderQuestion: () => {
    const question = hiraganaPractice.getCurrentQuestion();
    const total = hiraganaPractice.questions.length;
    const currentNumber = hiraganaPractice.questionIndex + 1;

    hiraganaPractice.answered = false;
    hiraganaPractice.get("#score-value").textContent = String(
      hiraganaPractice.score,
    );
    hiraganaPractice.get("#progress-text").textContent =
      `Câu ${currentNumber} / ${total}`;
    hiraganaPractice.get("#progress-bar").style.width =
      `${(currentNumber / total) * 100}%`;
    const feedback = hiraganaPractice.get("#feedback");
    feedback.textContent = "";
    feedback.className = "feedback";

    const nextButton = hiraganaPractice.get("#next-button");
    nextButton.disabled = true;
    nextButton.textContent =
      currentNumber === total ? "Xem kết quả" : "Câu tiếp theo";

    if (hiraganaPractice.selectedMode === "multiple-choice") {
      hiraganaPractice.renderMultipleChoice(question);
    } else {
      const kanaType = hiraganaPractice.getKanaType(question.answer);
      hiraganaPractice.get("#word-type").textContent = question.wordType
        ? `${question.wordType} · ${kanaType}`
        : kanaType;
      hiraganaPractice.get("#question-prompt").textContent =
        hiraganaPractice.getPrompt(question);

      const kanjiReading = hiraganaPractice.getExerciseReading(question.kanji);
      hiraganaPractice.get("#question-meaning").textContent =
        kanjiReading === question.answer
          ? "Hãy ghép cách đọc Kana đúng"
          : question.meaning;
      hiraganaPractice.renderAssembly(question);
    }
  },

  renderMultipleChoice: (question) => {
    const challenge =
      hiraganaPractice.buildMultipleChoiceChallenge(question);
    hiraganaPractice.currentChallenge = challenge;
    hiraganaPractice.get("#word-type").textContent = question.wordType
      ? `${question.wordType} · ${challenge.direction}`
      : challenge.direction;
    hiraganaPractice.get("#question-prompt").textContent = challenge.prompt;
    hiraganaPractice.get("#question-meaning").textContent =
      `Chọn ${challenge.answerLabel} phù hợp`;

    const answerArea = hiraganaPractice.get("#answer-area");
    const choiceGrid = document.createElement("div");
    choiceGrid.className = "choice-grid";

    challenge.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        `choice-button choice-button--${challenge.answerField}`;
      button.dataset.choice = choice;
      button.dataset.key = String(index + 1);
      button.textContent = choice;
      button.addEventListener("click", () => {
        hiraganaPractice.selectChoice(choice, button);
      });
      choiceGrid.append(button);
    });

    answerArea.replaceChildren(choiceGrid);
  },

  selectChoice: (choice, selectedButton) => {
    if (hiraganaPractice.answered) {
      return;
    }

    const challenge = hiraganaPractice.currentChallenge;
    const isCorrect = choice === challenge.answer;
    document.querySelectorAll(".choice-button").forEach((button) => {
      button.disabled = true;
      if (button.dataset.choice === challenge.answer) {
        button.classList.add("is-correct");
      }
    });
    if (!isCorrect) {
      selectedButton.classList.add("is-wrong");
    }

    hiraganaPractice.finishAnswer(isCorrect, choice, challenge.answer);
  },

  renderAssembly: (question) => {
    const characters = hiraganaPractice.splitReading(question.answer);
    hiraganaPractice.answerTokenCount = characters.length;

    const answerTokens = characters.map((character, index) => ({
      id: `${index}-${character}`,
      character,
    }));

    const answerCharacters = new Set(characters);
    const distractorCount = Math.min(
      6,
      Math.max(3, Math.ceil(characters.length * 0.4)),
    );
    const distractorTokens = hiraganaPractice
      .shuffle(
        hiraganaPractice.getDistractorPool(question.answer).filter(
          (character) => !answerCharacters.has(character),
        ),
      )
      .slice(0, distractorCount)
      .map((character, index) => ({
        id: `distractor-${index}-${character}`,
        character,
      }));

    hiraganaPractice.availableTokens = hiraganaPractice.shuffle([
      ...answerTokens,
      ...distractorTokens,
    ]);
    hiraganaPractice.selectedTokens = [];

    const answerArea = hiraganaPractice.get("#answer-area");
    answerArea.innerHTML = `
      <div class="assemble-board">
        <div class="token-zone token-zone--answer">
          <span class="token-zone-label">Đáp án của bạn</span>
          <div id="selected-tokens" class="token-list"></div>
        </div>
        <div class="token-zone">
          <span class="token-zone-label">
            Chọn ${characters.length} ký tự — có ký tự gây nhiễu
          </span>
          <div id="available-tokens" class="token-list"></div>
        </div>
        <div class="assemble-actions">
          <button id="reset-tokens-button" type="button" class="text-button">Làm lại</button>
          <button id="check-assembly-button" type="button" class="primary-button" disabled>
            Kiểm tra
          </button>
        </div>
      </div>
    `;

    hiraganaPractice
      .get("#reset-tokens-button")
      .addEventListener("click", hiraganaPractice.resetTokens);
    hiraganaPractice
      .get("#check-assembly-button")
      .addEventListener("click", hiraganaPractice.checkAssembly);
    hiraganaPractice.renderTokens();
  },

  createTokenButton: (token, source) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kana-token";
    button.textContent = token.character;
    button.disabled =
      hiraganaPractice.answered ||
      (source === "available" &&
        hiraganaPractice.selectedTokens.length >=
          hiraganaPractice.answerTokenCount);
    button.addEventListener("click", () => {
      hiraganaPractice.moveToken(token.id, source);
    });
    return button;
  },

  renderTokens: () => {
    const availableContainer = hiraganaPractice.get("#available-tokens");
    const selectedContainer = hiraganaPractice.get("#selected-tokens");
    if (!availableContainer || !selectedContainer) {
      return;
    }

    availableContainer.replaceChildren(
      ...hiraganaPractice.availableTokens.map((token) =>
        hiraganaPractice.createTokenButton(token, "available"),
      ),
    );
    selectedContainer.replaceChildren(
      ...hiraganaPractice.selectedTokens.map((token) =>
        hiraganaPractice.createTokenButton(token, "selected"),
      ),
    );

    const checkButton = hiraganaPractice.get("#check-assembly-button");
    const resetButton = hiraganaPractice.get("#reset-tokens-button");
    if (checkButton) {
      checkButton.disabled =
        hiraganaPractice.answered ||
        hiraganaPractice.selectedTokens.length !==
          hiraganaPractice.answerTokenCount;
    }
    if (resetButton) {
      resetButton.disabled =
        hiraganaPractice.answered ||
        hiraganaPractice.selectedTokens.length === 0;
    }
  },

  moveToken: (tokenId, source) => {
    if (hiraganaPractice.answered) {
      return;
    }
    if (
      source === "available" &&
      hiraganaPractice.selectedTokens.length >=
        hiraganaPractice.answerTokenCount
    ) {
      return;
    }

    const from =
      source === "available"
        ? hiraganaPractice.availableTokens
        : hiraganaPractice.selectedTokens;
    const to =
      source === "available"
        ? hiraganaPractice.selectedTokens
        : hiraganaPractice.availableTokens;
    const tokenIndex = from.findIndex((token) => token.id === tokenId);
    if (tokenIndex === -1) {
      return;
    }

    const [token] = from.splice(tokenIndex, 1);
    to.push(token);
    hiraganaPractice.renderTokens();
  },

  resetTokens: () => {
    hiraganaPractice.availableTokens = hiraganaPractice.shuffle([
      ...hiraganaPractice.availableTokens,
      ...hiraganaPractice.selectedTokens,
    ]);
    hiraganaPractice.selectedTokens = [];
    hiraganaPractice.renderTokens();
  },

  checkAssembly: () => {
    if (hiraganaPractice.answered) {
      return;
    }

    const response = hiraganaPractice.selectedTokens
      .map((token) => token.character)
      .join("");
    const question = hiraganaPractice.getCurrentQuestion();
    hiraganaPractice.finishAnswer(response === question.answer, response);
    hiraganaPractice.renderTokens();
  },

  finishAnswer: (isCorrect, response, expectedAnswer = null) => {
    const question = hiraganaPractice.getCurrentQuestion();
    const correctAnswer = expectedAnswer || question.answer;
    const prompt =
      hiraganaPractice.selectedMode === "multiple-choice"
        ? hiraganaPractice.currentChallenge.prompt
        : hiraganaPractice.getPrompt(question);
    hiraganaPractice.answered = true;
    if (isCorrect) {
      hiraganaPractice.score += 1;
    }

    hiraganaPractice.results.push({
      question,
      isCorrect,
      response,
      correctAnswer,
      prompt,
    });
    hiraganaPractice.get("#score-value").textContent = String(
      hiraganaPractice.score,
    );

    const feedback = hiraganaPractice.get("#feedback");
    feedback.className = `feedback ${isCorrect ? "is-correct" : "is-wrong"}`;
    feedback.textContent = isCorrect
      ? `Chính xác! ${correctAnswer}`
      : `Chưa đúng. Đáp án là: ${correctAnswer}`;
    hiraganaPractice.get("#next-button").disabled = false;
  },

  nextQuestion: () => {
    if (!hiraganaPractice.answered) {
      return;
    }

    if (
      hiraganaPractice.questionIndex >=
      hiraganaPractice.questions.length - 1
    ) {
      hiraganaPractice.renderResult();
      return;
    }

    hiraganaPractice.questionIndex += 1;
    hiraganaPractice.renderQuestion();
  },

  renderResult: () => {
    const total = hiraganaPractice.questions.length;
    const percentage = hiraganaPractice.score / total;
    hiraganaPractice.get("#final-score").textContent =
      `${hiraganaPractice.score}/${total}`;
    hiraganaPractice.get("#result-message").textContent =
      percentage === 1
        ? "Tuyệt vời, bạn đã nhớ toàn bộ!"
        : percentage >= 0.7
          ? "Rất tốt, chỉ cần ôn thêm một chút."
          : "Không sao, mỗi lượt là một lần nhớ lâu hơn.";

    const mistakeList = hiraganaPractice.get("#mistake-list");
    const mistakes = hiraganaPractice.results.filter(
      (result) => !result.isCorrect,
    );
    if (!mistakes.length) {
      const perfectMessage = document.createElement("p");
      perfectMessage.textContent = "Không có từ nào cần ôn lại trong lượt này.";
      mistakeList.replaceChildren(perfectMessage);
    } else {
      const fragment = document.createDocumentFragment();
      mistakes.forEach(({ prompt: resultPrompt, response, correctAnswer }) => {
        const item = document.createElement("div");
        item.className = "mistake-item";

        const prompt = document.createElement("strong");
        prompt.textContent = resultPrompt;

        const detail = document.createElement("span");
        detail.textContent =
          `Bạn trả lời: ${response || "—"} · Đáp án: ${correctAnswer}`;
        item.append(prompt, detail);
        fragment.append(item);
      });
      mistakeList.replaceChildren(fragment);
    }

    hiraganaPractice.showPanel("result");
  },

  bindEvents: () => {
    hiraganaPractice.get("#start-button").disabled = true;
    document.querySelectorAll(".mode-card").forEach((button) => {
      button.addEventListener("click", () => {
        hiraganaPractice.setMode(button.dataset.mode);
      });
    });
    hiraganaPractice
      .get("#start-button")
      .addEventListener("click", hiraganaPractice.startSession);
    hiraganaPractice
      .get("#session-size-select")
      .addEventListener("change", hiraganaPractice.updateSessionSizeLabels);
    hiraganaPractice
      .get("#next-button")
      .addEventListener("click", hiraganaPractice.nextQuestion);
    hiraganaPractice
      .get("#leave-session-button")
      .addEventListener("click", () => hiraganaPractice.showPanel("setup"));
    hiraganaPractice
      .get("#back-to-setup-button")
      .addEventListener("click", () => hiraganaPractice.showPanel("setup"));
    hiraganaPractice
      .get("#restart-button")
      .addEventListener("click", hiraganaPractice.startSession);

    window.addEventListener("keydown", (event) => {
      if (
        hiraganaPractice.get("#exercise-panel").hidden ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }

      if (
        hiraganaPractice.selectedMode === "multiple-choice" &&
        !hiraganaPractice.answered &&
        ["1", "2", "3", "4"].includes(event.key)
      ) {
        const button = document.querySelector(
          `.choice-button[data-key="${event.key}"]`,
        );
        if (button) {
          event.preventDefault();
          button.click();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (hiraganaPractice.answered) {
          hiraganaPractice.nextQuestion();
        } else if (hiraganaPractice.selectedMode === "assemble") {
          hiraganaPractice.get("#check-assembly-button")?.click();
        }
      }
    });
    hiraganaPractice.updateSessionSizeLabels();
  },
};

void hiraganaPractice.initialize();
