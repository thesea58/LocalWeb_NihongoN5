(() => {
  "use strict";

  const MANIFEST_URL = "../data/Eng-Ja-Vi/toeic_datasets.json";
  const STORAGE_KEY = "toeic.selected-dataset";
  const DEFAULT_DATASET_VERSION_KEY = "toeic.dataset-default-version";
  const CURRENT_DEFAULT_VERSION = "toeic-600-essential-en-vi-v1";
  const LOCAL_FILE_ID = "__local_file__";
  const FALLBACK_DATASETS = [
    {
      id: "toeic-600-essential-en-vi",
      label: "600 Essential Words · Anh–Việt",
      description: "Dữ liệu Anh–Việt từ Excel; trường tiếng Nhật để trống.",
      url: "../data/Eng-Ja-Vi/toeic_600_essential_words_en_vi.json?vietnamese=original",
      default: true,
    },
    {
      id: "toeic-tsl-1-500-english-reviewed",
      label: "TOEIC TSL 1–500 · Việt theo English",
      description: "Nghĩa tiếng Việt được ưu tiên diễn giải từ tiếng Anh.",
      url: "../data/Eng-Ja-Vi/toeic_tsl_1_500_vocabularies_with_readings.json?vietnamese=english-reviewed",
    },
    {
      id: "toeic-tsl-1-500-original",
      label: "TOEIC TSL 1–500 · Dữ liệu gốc",
      description: "Giữ nguyên nghĩa tiếng Việt trong file JSON gốc.",
      url: "../data/Eng-Ja-Vi/toeic_tsl_1_500_vocabularies_with_readings.json?vietnamese=original",
    },
  ];

  const select = document.getElementById("datasetSelect");
  const fileInput = document.getElementById("jsonFileInput");
  const storage = window.toeicStorage?.local;
  let datasets = [];
  let selectedDataset = null;

  function validateManifest(payload) {
    if (!payload || !Array.isArray(payload.datasets)) {
      throw new Error("Danh sách bộ dữ liệu không hợp lệ.");
    }

    const ids = new Set();
    const valid = payload.datasets
      .filter((item) => item && [item.id, item.label, item.url].every((value) => typeof value === "string"))
      .map((item) => ({
        id: item.id.trim(),
        label: item.label.trim(),
        description: typeof item.description === "string" ? item.description.trim() : "",
        url: item.url.trim(),
        default: item.default === true,
      }))
      .filter((item) => item.id && item.label && item.url && !ids.has(item.id) && ids.add(item.id));

    if (!valid.length) throw new Error("Không có bộ dữ liệu hợp lệ.");
    return valid;
  }

  async function initialize() {
    try {
      const response = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Không tải được danh sách dữ liệu (${response.status}).`);
      datasets = validateManifest(await response.json());
    } catch (error) {
      console.warn("Sử dụng danh sách dữ liệu dự phòng:", error);
      datasets = FALLBACK_DATASETS.map((item) => ({ ...item }));
    }

    const defaultDataset = datasets.find((item) => item.default) || datasets[0];
    const savedDefaultVersion = storage?.get(DEFAULT_DATASET_VERSION_KEY, "") || "";
    const savedId = savedDefaultVersion === CURRENT_DEFAULT_VERSION
      ? storage?.get(STORAGE_KEY, "") || ""
      : "";

    selectedDataset = datasets.find((item) => item.id === savedId)
      || defaultDataset;

    storage?.set(STORAGE_KEY, selectedDataset.id);
    storage?.set(DEFAULT_DATASET_VERSION_KEY, CURRENT_DEFAULT_VERSION);
    renderOptions();
    return selectedDataset;
  }

  function renderOptions() {
    if (!select || !selectedDataset) return;
    select.replaceChildren();
    datasets.forEach((dataset) => {
      const option = document.createElement("option");
      option.value = dataset.id;
      option.textContent = dataset.label;
      select.append(option);
    });
    const localOption = document.createElement("option");
    localOption.value = LOCAL_FILE_ID;
    localOption.textContent = "＋ Chọn file JSON từ máy...";
    select.append(localOption);
    select.value = selectedDataset.id;
    select.title = selectedDataset.description || selectedDataset.label;
    select.disabled = false;
  }

  async function loadSelectedPayload() {
    const dataset = selectedDataset || await ready;
    const url = new URL(dataset.url, window.location.href);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Không tải được JSON (${response.status}).`);
    const payload = await response.json();

    if (url.searchParams.get("vietnamese") === "original") return payload;
    return window.toeicVietnameseGlossary?.applyEnglishReviewedVietnamese(payload) || payload;
  }

  select?.addEventListener("change", () => {
    if (select.value === LOCAL_FILE_ID) {
      select.value = selectedDataset?.id || datasets[0]?.id || "";
      fileInput?.click();
      return;
    }

    const nextDataset = datasets.find((item) => item.id === select.value);
    if (!nextDataset || nextDataset.id === selectedDataset?.id) return;
    selectedDataset = nextDataset;
    storage?.set(STORAGE_KEY, nextDataset.id);
    storage?.set(DEFAULT_DATASET_VERSION_KEY, CURRENT_DEFAULT_VERSION);
    select.disabled = true;
    window.location.reload();
  });

  fileInput?.addEventListener("change", () => {
    const [file] = fileInput.files || [];
    if (!file || !select) return;
    const option = document.createElement("option");
    option.value = "__local_loaded__";
    option.textContent = `Tệp máy: ${file.name}`;
    select.insertBefore(option, select.lastElementChild);
    select.value = option.value;
    select.title = file.name;
  });

  const ready = initialize();
  window.toeicDatasetService = { ready, loadSelectedPayload };
})();
