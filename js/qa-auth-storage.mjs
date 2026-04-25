/** 브라우저에만 보관 — 같은 기기·브라우저에서만 ‘내가 쓴 글’ 삭제 가능 */

var P_Q = "mortgageloan-qa:q:v1:";
var P_A = "mortgageloan-qa:a:v1:";

export function newAuthorSecret() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function setQuestionDeleteSecret(questionId, secret) {
  try {
    if (questionId && secret) localStorage.setItem(P_Q + questionId, secret);
  } catch (e) {}
}

export function getQuestionDeleteSecret(questionId) {
  try {
    return localStorage.getItem(P_Q + questionId);
  } catch (e) {
    return null;
  }
}

export function clearQuestionDeleteSecret(questionId) {
  try {
    if (questionId) localStorage.removeItem(P_Q + questionId);
  } catch (e) {}
}

export function setAnswerDeleteSecret(answerId, secret) {
  try {
    if (answerId && secret) localStorage.setItem(P_A + answerId, secret);
  } catch (e) {}
}

export function getAnswerDeleteSecret(answerId) {
  try {
    return localStorage.getItem(P_A + answerId);
  } catch (e) {
    return null;
  }
}

export function clearAnswerDeleteSecret(answerId) {
  try {
    if (answerId) localStorage.removeItem(P_A + answerId);
  } catch (e) {}
}
