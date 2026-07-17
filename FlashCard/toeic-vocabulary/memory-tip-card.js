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

    const word = currentVocabulary();
    const memoryTip = typeof word?.memory_tip_vi === "string"
      ? word.memory_tip_vi.trim()
      : "";

    let tip = panel.querySelector(".memory-tip-vi");

    if (!memoryTip) {
      tip?.remove();
      return;
    }

    if (!tip) {
      tip = document.createElement("p");
      tip.className = "memory-tip-vi";

      const label = document.createElement("span");
      label.className = "memory-tip-label";
      label.textContent = "Mẹo nhớ";

      const text = document.createElement("span");
      text.className = "memory-tip-text";

      tip.append(label, text);
      vietnameseText.insertAdjacentElement("afterend", tip);
    }

    const text = tip.querySelector(".memory-tip-text");
    if (text && text.textContent !== memoryTip) {
      text.textContent = memoryTip;
    }
  }

  const observer = new MutationObserver((mutations) => {
    const cardWasReplaced = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) =>
        node.nodeType === Node.ELEMENT_NODE
        && (node.matches?.(".card-topline, .language-section") || node.querySelector?.("#vietnameseWord")),
      ),
    );

    if (cardWasReplaced) {
      renderVietnameseMemoryTip();
    }
  });

  observer.observe(cardHost, { childList: true, subtree: true });
  renderVietnameseMemoryTip();
})();
