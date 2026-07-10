(() => {
  "use strict";

  const ALL_CATEGORIES = "";
  const STORAGE_PREFIX = "toeic.selected-category.";
  const select = document.getElementById("categorySelect");
  const storage = window.toeicStorage?.local;
  const datasetService = window.toeicDatasetService;

  if (!select || !datasetService || typeof datasetService.loadSelectedPayload !== "function") {
    return;
  }

  const originalLoadSelectedPayload = datasetService.loadSelectedPayload.bind(datasetService);
  let currentDatasetId = "unknown";

  function normalizeCategory(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getStorageKey() {
    return `${STORAGE_PREFIX}${currentDatasetId}`;
  }

  function collectCategories(words) {
    return [...new Set(words.map((word) => normalizeCategory(word?.category)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "en", {
        sensitivity: "base",
        numeric: true,
      }));
  }

  function renderOptions(categories, selectedCategory) {
    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = ALL_CATEGORIES;
    allOption.textContent = "Tất cả";
    select.append(allOption);

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      select.append(option);
    });

    select.value = selectedCategory;
    select.disabled = categories.length === 0;
    select.title = categories.length
      ? "Lọc từ vựng theo category"
      : "Bộ dữ liệu này không có trường category";
  }

  async function loadSelectedPayload() {
    const selectedDataset = await datasetService.ready;
    currentDatasetId = selectedDataset?.id || "unknown";

    const payload = await originalLoadSelectedPayload();
    const words = Array.isArray(payload?.vocabularies) ? payload.vocabularies : [];
    const categories = collectCategories(words);
    const savedCategory = storage?.get(getStorageKey(), "") || "";
    const selectedCategory = categories.includes(savedCategory)
      ? savedCategory
      : ALL_CATEGORIES;

    if (savedCategory !== selectedCategory) {
      storage?.set(getStorageKey(), selectedCategory);
    }

    renderOptions(categories, selectedCategory);

    if (!selectedCategory) {
      return payload;
    }

    return {
      ...payload,
      vocabularies: words.filter(
        (word) => normalizeCategory(word?.category) === selectedCategory,
      ),
      category_filter: {
        selected: selectedCategory,
        total_categories: categories.length,
      },
    };
  }

  select.addEventListener("change", () => {
    storage?.set(getStorageKey(), select.value);
    select.disabled = true;
    window.location.reload();
  });

  window.toeicDatasetService = {
    ...datasetService,
    loadSelectedPayload,
  };
})();
