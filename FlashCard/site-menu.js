(() => {
  "use strict";

  const items = [
    { key: "flashcard", label: "Flash Card", href: "/FlashCard/" },
    { key: "kana", label: "Luyện Kana", href: "/FlashCard/hiragana.html" },
    { key: "toeic", label: "TOEIC Vocabulary", href: "/FlashCard/toeic-vocabulary/" },
  ];

  const pathname = window.location.pathname.toLowerCase();
  const currentKey = pathname.includes("toeic-vocabulary")
    ? "toeic"
    : pathname.includes("hiragana")
      ? "kana"
      : "flashcard";

  const style = document.createElement("style");
  style.textContent = `
    body { padding-top: 76px !important; }
    .site-menu {
      position: fixed;
      z-index: 9999;
      top: 0;
      right: 0;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 60px;
      padding: 10px max(16px, calc((100vw - 1120px) / 2));
      border-bottom: 1px solid rgba(23, 32, 51, 0.12);
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 8px 24px rgba(31, 41, 55, 0.08);
      backdrop-filter: blur(14px);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .site-menu__brand {
      color: #172033;
      font-size: 0.92rem;
      font-weight: 850;
      text-decoration: none;
      white-space: nowrap;
    }
    .site-menu__links {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .site-menu__link {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 0 14px;
      border-radius: 999px;
      color: #4b5563;
      font-size: 0.86rem;
      font-weight: 750;
      text-decoration: none;
      transition: background 150ms ease, color 150ms ease, transform 150ms ease;
    }
    .site-menu__link:hover,
    .site-menu__link:focus-visible {
      outline: none;
      background: #eef2ff;
      color: #4338ca;
      transform: translateY(-1px);
    }
    .site-menu__link[aria-current="page"] {
      background: #4f46e5;
      color: #fff;
    }
    @media (max-width: 680px) {
      body { padding-top: 112px !important; }
      .site-menu {
        align-items: flex-start;
        flex-direction: column;
        gap: 7px;
        padding: 9px 12px;
      }
      .site-menu__links {
        width: 100%;
        justify-content: flex-start;
        overflow-x: auto;
        padding-bottom: 2px;
      }
      .site-menu__link {
        min-height: 34px;
        padding: 0 11px;
        font-size: 0.8rem;
        white-space: nowrap;
      }
    }
  `;

  const menu = document.createElement("nav");
  menu.className = "site-menu";
  menu.setAttribute("aria-label", "Menu học tập chính");
  menu.innerHTML = `
    <a class="site-menu__brand" href="/">日本語 Study</a>
    <ul class="site-menu__links">
      ${items
        .map(
          (item) => `
            <li>
              <a
                class="site-menu__link"
                href="${item.href}"
                ${item.key === currentKey ? 'aria-current="page"' : ""}
              >${item.label}</a>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;

  document.head.append(style);
  document.body.prepend(menu);
})();
