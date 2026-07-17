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
    const