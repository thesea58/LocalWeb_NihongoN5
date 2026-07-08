(() => {
  "use strict";

  const card = document.getElementById("cardHost");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");

  if (!card || !previousButton || !nextButton) {
    return;
  }

  const MIN_SWIPE_DISTANCE = 60;
  const MAX_SWIPE_DURATION = 800;
  const HORIZONTAL_RATIO = 1.25;
  const INTERACTIVE_SELECTOR =
    "button, a, input, textarea, select, [role='button'], [contenteditable='true']";

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let tracking = false;

  card.style.touchAction = "pan-y pinch-zoom";
  card.style.overscrollBehaviorX = "contain";

  function resetGesture() {
    startX = 0;
    startY = 0;
    startTime = 0;
    tracking = false;
    card.classList.remove("is-swiping");
  }

  card.addEventListener(
    "touchstart",
    (event) => {
      if (
        event.touches.length !== 1 ||
        event.target.closest(INTERACTIVE_SELECTOR)
      ) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      tracking = true;
      card.classList.add("is-swiping");
    },
    { passive: true },
  );

  card.addEventListener(
    "touchend",
    (event) => {
      if (!tracking || event.changedTouches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const duration = Date.now() - startTime;
      const horizontalDistance = Math.abs(deltaX);
      const verticalDistance = Math.abs(deltaY);

      const isHorizontalSwipe =
        duration <= MAX_SWIPE_DURATION &&
        horizontalDistance >= MIN_SWIPE_DISTANCE &&
        horizontalDistance > verticalDistance * HORIZONTAL_RATIO;

      resetGesture();

      if (!isHorizontalSwipe) {
        return;
      }

      if (deltaX < 0 && !nextButton.disabled) {
        nextButton.click();
      } else if (deltaX > 0 && !previousButton.disabled) {
        previousButton.click();
      }
    },
    { passive: true },
  );

  card.addEventListener("touchcancel", resetGesture, { passive: true });

  const hint = document.createElement("p");
  hint.className = "mobile-swipe-hint";
  hint.textContent = "Vuốt trái: từ tiếp theo · Vuốt phải: từ trước";
  hint.setAttribute("aria-hidden", "true");
  card.insertAdjacentElement("afterend", hint);

  const style = document.createElement("style");
  style.textContent = `
    .study-card.is-swiping {
      transition: transform 120ms ease;
    }

    .mobile-swipe-hint {
      display: none;
      margin: 12px 6px 0;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 650;
      text-align: center;
    }

    @media (hover: none) and (pointer: coarse) {
      .mobile-swipe-hint {
        display: block;
      }
    }
  `;
  document.head.append(style);
})();
