import { escapeHtml } from "../utils/text.js";

export function activityLink({ href, icon, title, detail = "TODO", ready = false }) {
  return `<a class="activity-link ${ready ? "is-ready" : ""}" href="${href}"><span class="activity-icon">${escapeHtml(icon)}</span><span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></span></a>`;
}
