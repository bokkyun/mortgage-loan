/**
 * 토론 본문: 마크다운(GFM 표·이미지·링크 등) → sanitize된 HTML
 * 실패 시 일반 텍스트(줄바꿈만)로 폴백
 */
import DOMPurify from "https://esm.sh/dompurify@3.1.6";
import { marked } from "https://esm.sh/marked@12.0.2";

marked.use({
  gfm: true,
  breaks: true,
});

var ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "del",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
  "hr",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "img",
  "span",
  "div",
];

var ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title", "colspan", "rowspan", "class"];

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2brEscaped(s) {
  return escapeHtml(s).replace(/\r\n|\r|\n/g, "<br />");
}

DOMPurify.addHook("afterSanitizeAttributes", function (node) {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function renderDiscussBody(raw) {
  if (raw == null || String(raw).trim() === "") return "";
  try {
    var html = marked.parse(String(raw), { async: false });
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  } catch (e) {
    return nl2brEscaped(raw);
  }
}
