"use strict";

(() => {
  const cardHost = document.getElementById("cardHost");
  if (!cardHost) return;

  function currentVocabulary() {
    if (typeof vocabularies === "undefined" || typeof currentIndex === "undefined") {
      return null;
    }

    return Array.isArray(vocabularies) ? vocabularies[currentIndex] : null;
  }

  function renderVietnameseMemoryTip() {
    const vietnameseText = cardHost.querySelector("#vietnameseWord");
    if (!vietnameseText) return;

    const panel = vietnameseText.closest(".translation-panel");
    if (!panel) return;

    panel.querySelector(".memory-tip-vi")?.remove();

    const word = currentVocabulary();
    const memoryTip = typeof word?.memory_tip_vi === "string"
      ? word.memory_tip_vi.trim()
      : "";

    if (!memoryTip) return;

    const tip = document.createElement("p");
    tip.className = "memory-tip-vi";

    const label = document.createElement("span");
    label.className = "memory-tip-label";
    label.textContent = "Mẹo nhớ";

    const text = document.createElement("span");
    text.className = "memory-tip-text";
    text.textContent = memoryTip;

    tip.append(label, text);
    vietnameseText.insertAdjacentElement("afterend", tip);
  }

  const observer = new MutationObserver(renderVietnameseMemoryTip);
  observer.observe(cardHost, { childList: true, subtree: true });

  renderVietnameseMemoryTip();
})();
