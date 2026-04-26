/** 브라우저에만 보관 — 토론글·댓글 삭제용 (Q&A와 키 분리) */

var P_T = "mortgageloan-discuss:t:v1:";
var P_R = "mortgageloan-discuss:r:v1:";

export var DISCUSS_CATEGORY_LABELS = {
  irp: "IRP",
  deposit: "예·적금",
  card: "신용카드",
  pay: "페이",
  telecom: "통신",
};

export var DISCUSS_CATEGORY_SLUGS = Object.keys(DISCUSS_CATEGORY_LABELS);

export function categoryLabel(slug) {
  return DISCUSS_CATEGORY_LABELS[slug] || slug || "";
}

export function newAuthorSecret() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function setThreadDeleteSecret(threadId, secret) {
  try {
    if (threadId && secret) localStorage.setItem(P_T + threadId, secret);
  } catch (e) {}
}

export function getThreadDeleteSecret(threadId) {
  try {
    return localStorage.getItem(P_T + threadId);
  } catch (e) {
    return null;
  }
}

export function clearThreadDeleteSecret(threadId) {
  try {
    if (threadId) localStorage.removeItem(P_T + threadId);
  } catch (e) {}
}

export function setReplyDeleteSecret(replyId, secret) {
  try {
    if (replyId && secret) localStorage.setItem(P_R + replyId, secret);
  } catch (e) {}
}

export function getReplyDeleteSecret(replyId) {
  try {
    return localStorage.getItem(P_R + replyId);
  } catch (e) {
    return null;
  }
}

export function clearReplyDeleteSecret(replyId) {
  try {
    if (replyId) localStorage.removeItem(P_R + replyId);
  } catch (e) {}
}
