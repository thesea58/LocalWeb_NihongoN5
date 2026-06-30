(() => {
  "use strict";

  const shortcuts = {
    1: ".button-show",
    2: ".button-next",
    3: ".button-check",
    4: ".button-submit",
  };

  const clickButton = (selector) => {
    const button = document.querySelector(selector);
    if (button && !button.disabled) {
      button.click();
    }
  };

  const isEditableElement = (element) =>
    element instanceof Element &&
    element.matches('input, textarea, select, [contenteditable="true"]');

  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const target = event.target;

    if (event.key === "Enter" && target instanceof Element) {
      if (target.matches(".inputResult")) {
        event.preventDefault();
        clickButton(".button-check");
        return;
      }

      if (target.matches("#from, #to")) {
        event.preventDefault();
        clickButton(".button-submit");
        return;
      }
    }

    // Number keys must remain available while the user is typing an answer/range.
    if (isEditableElement(target)) {
      return;
    }

    const buttonSelector = shortcuts[event.key];
    if (!buttonSelector) {
      return;
    }

    event.preventDefault();
    clickButton(buttonSelector);
  });
})();
