import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  newAuthorSecret,
  getQuestionDeleteSecret,
  setAnswerDeleteSecret,
  getAnswerDeleteSecret,
  clearQuestionDeleteSecret,
  clearAnswerDeleteSecret,
} from "../js/qa-auth-storage.mjs";

var supabase = null;

function el(id) {
  return document.getElementById(id);
}

function getConfig() {
  return (typeof window !== "undefined" && window.SUPABASE_QA) || {};
}

function getClient() {
  var config = getConfig();
  if (!config.url || !config.anonKey) return null;
  if (!supabase) supabase = createClient(config.url, config.anonKey);
  return supabase;
}

function hasClient() {
  var c = getConfig();
  return !!(c.url && c.anonKey);
}

function showConfigMissing() {
  var n = el("qa-unavailable-notice");
  if (n) n.hidden = false;
  var main = el("qa-main");
  if (main) main.hidden = true;
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(s) {
  return escapeHtml(s).replace(/\r\n|\r|\n/g, "<br />");
}

var PAGE_SIZE = 20;

function getListPage() {
  var p = new URLSearchParams(window.location.search);
  if (p.get("id")) return 1;
  var n = parseInt(p.get("page") || "1", 10);
  if (!Number.isFinite(n) || n < 1) n = 1;
  return n;
}

function getSearchQuery() {
  return (new URLSearchParams(window.location.search).get("q") || "").trim();
}

function sanitizeIlikeInput(raw) {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 200);
}

function buildBackToListHref() {
  var p = new URLSearchParams(window.location.search);
  p.delete("id");
  var s = p.toString();
  return s ? "?" + s : "./";
}

function listPageHref(pageNum, searchQ) {
  var q = (searchQ != null && searchQ !== undefined ? String(searchQ) : getSearchQuery()).trim();
  if (q) {
    if (pageNum <= 1) return "?q=" + encodeURIComponent(q);
    return "?q=" + encodeURIComponent(q) + "&page=" + pageNum;
  }
  if (pageNum <= 1) return "./";
  return "?page=" + pageNum;
}

function listDetailHref(pageNum, searchQ, id) {
  var p = new URLSearchParams();
  var q = (searchQ != null && searchQ !== undefined ? String(searchQ) : getSearchQuery()).trim();
  if (q) p.set("q", q);
  if (pageNum > 1) p.set("page", String(pageNum));
  p.set("id", id);
  return "?" + p.toString();
}

function setSearchSummary(on, line) {
  var s = el("qa-search-summary");
  if (!s) return;
  if (on && line) {
    s.textContent = line;
    s.removeAttribute("hidden");
  } else {
    s.textContent = "";
    s.setAttribute("hidden", "hidden");
  }
}

function syncSearchChrome() {
  var p = new URLSearchParams(window.location.search);
  var qRaw = p.get("q") || "";
  var inp = el("qa-search-input");
  if (inp) inp.value = qRaw;
  var reset = el("qa-search-reset");
  if (reset) {
    reset.hidden = !qRaw.trim();
  }
}

function renderPagination(pageNum, total, listSearchQ) {
  var nav = el("qa-pagination");
  if (!nav) return;
  var totalPages = Math.max(1, total === 0 ? 1 : Math.ceil(total / PAGE_SIZE));
  if (total === 0) {
    nav.hidden = true;
    nav.innerHTML = "";
    return;
  }
  nav.hidden = false;
  var prevN = pageNum - 1;
  var nextN = pageNum + 1;
  var sq = listSearchQ != null && listSearchQ !== undefined ? listSearchQ : getSearchQuery();
  var prevHref = listPageHref(prevN, sq);
  var nextHref = listPageHref(nextN, sq);
  var prevAttr = pageNum <= 1 ? ' aria-disabled="true" href="#"' : ' href="' + prevHref + '"';
  var nextAttr = pageNum >= totalPages ? ' aria-disabled="true" href="#"' : ' href="' + nextHref + '"';
  nav.innerHTML =
    '<a' +
    prevAttr +
    ">이전</a>" +
    '<span class="qa-pagination__info">' +
    pageNum +
    " / " +
    totalPages +
    " 페이지 (총 " +
    total +
    "건)</span>" +
    '<a' +
    nextAttr +
    ">다음</a>";
}

async function loadSearchList(pageNum, qRaw) {
  if (pageNum == null || !Number.isFinite(pageNum)) pageNum = 1;
  var c = getClient();
  var listEl = el("qa-list");
  var errEl = el("qa-list-error");
  if (!c || !listEl) return;
  var safe = sanitizeIlikeInput(qRaw);
  if (!safe) {
    window.location.replace("./");
    return;
  }
  var pat = "%" + safe + "%";
  listEl.innerHTML = '<p class="field-hint">검색 중…</p>';
  var nav = el("qa-pagination");
  if (nav) {
    nav.hidden = true;
    nav.innerHTML = "";
  }
  if (errEl) {
    errEl.textContent = "";
    errEl.hidden = true;
  }
  setSearchSummary(false, "");
  var t1 = await c.from("qa_questions").select("id,title,author_nickname,created_at").ilike("title", pat);
  var t2 = await c.from("qa_questions").select("id,title,author_nickname,created_at").ilike("body", pat);
  if (t1.error || t2.error) {
    var e = t1.error || t2.error;
    if (errEl) {
      errEl.textContent = "검색에 실패했습니다. (" + (e && e.message ? e.message : "오류") + ")";
      errEl.hidden = false;
    }
    listEl.innerHTML = "";
    return;
  }
  var byId = new Map();
  function addRows(arr) {
    (arr || []).forEach(function (row) {
      if (row && row.id) byId.set(row.id, row);
    });
  }
  addRows(t1.data);
  addRows(t2.data);
  var tAns = await c.from("qa_answers").select("question_id").ilike("body", pat).limit(3000);
  if (tAns.error) {
    if (errEl) {
      errEl.textContent = "답변 검색에 실패했습니다. (" + tAns.error.message + ")";
      errEl.hidden = false;
    }
    listEl.innerHTML = "";
    return;
  }
  var need = [];
  var seenN = new Set();
  (tAns.data || []).forEach(function (a) {
    if (a && a.question_id && !byId.has(a.question_id) && !seenN.has(a.question_id)) {
      seenN.add(a.question_id);
      need.push(a.question_id);
    }
  });
  for (var bi = 0; bi < need.length; bi += 100) {
    var batch = need.slice(bi, bi + 100);
    var t3 = await c.from("qa_questions").select("id,title,author_nickname,created_at").in("id", batch);
    if (t3.error) {
      if (errEl) {
        errEl.textContent = "질문 정보를 불러오지 못했습니다. (" + t3.error.message + ")";
        errEl.hidden = false;
      }
      listEl.innerHTML = "";
      return;
    }
    addRows(t3.data);
  }
  var rows = Array.from(byId.values());
  rows.sort(function (a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  var total = rows.length;
  var totalPages = Math.max(1, total === 0 ? 1 : Math.ceil(total / PAGE_SIZE));
  if (pageNum > totalPages) {
    window.location.replace(listPageHref(totalPages, qRaw));
    return;
  }
  setSearchSummary(true, "「" + (getSearchQuery() || qRaw) + "」 검색 · " + total + "건");
  var slice = rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  renderPagination(pageNum, total, qRaw);
  if (total === 0) {
    listEl.innerHTML =
      '<p class="field-hint">검색 조건에 맞는 질문이 없습니다. 다른 키워드로 시도하거나 <a href="./">전체 목록</a>을 보세요.</p>';
    if (nav) nav.hidden = true;
    syncSearchChrome();
    return;
  }
  var html = '<ul class="doc-list" style="margin:0; list-style:none; padding:0">';
  for (var i = 0; i < slice.length; i++) {
    var r = slice[i];
    var nick = r.author_nickname ? escapeHtml(r.author_nickname) : "익명";
    var link = listDetailHref(pageNum, qRaw, r.id);
    html +=
      '<li style="margin:0.5rem 0; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface2)">' +
      '<a href="' +
      link +
      '" style="font-weight:700; text-decoration:none; color:var(--text)">' +
      escapeHtml(r.title) +
      "</a><br />" +
      '<span class="field-hint" style="font-size:0.75rem">' +
      nick +
      " · " +
      fmtDate(r.created_at) +
      "</span></li>";
  }
  html += "</ul>";
  listEl.innerHTML = html;
  syncSearchChrome();
}

async function loadList(pageNum) {
  if (pageNum == null || !Number.isFinite(pageNum)) pageNum = 1;
  if (getSearchQuery()) {
    return loadSearchList(pageNum, getSearchQuery());
  }
  var c = getClient();
  var listEl = el("qa-list");
  var errEl = el("qa-list-error");
  if (!c || !listEl) return;
  listEl.innerHTML = '<p class="field-hint">불러오는 중…</p>';
  var nav = el("qa-pagination");
  if (nav) {
    nav.hidden = true;
    nav.innerHTML = "";
  }
  if (errEl) {
    errEl.textContent = "";
    errEl.hidden = true;
  }
  setSearchSummary(false, "");
  var from = (pageNum - 1) * PAGE_SIZE;
  var to = from + PAGE_SIZE - 1;
  var res = await c
    .from("qa_questions")
    .select("id,title,author_nickname,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (res.error) {
    if (errEl) {
      errEl.textContent = "목록을 불러오지 못했습니다. (" + res.error.message + ")";
      errEl.hidden = false;
    }
    listEl.innerHTML = "";
    return;
  }
  var total = res.count != null ? res.count : 0;
  var totalPages = Math.max(1, total === 0 ? 1 : Math.ceil(total / PAGE_SIZE));
  if (pageNum > totalPages) {
    window.location.replace(listPageHref(totalPages, ""));
    return;
  }
  var rows = res.data || [];
  if (rows.length === 0 && total > 0 && pageNum > 1) {
    window.location.replace("./");
    return;
  }
  renderPagination(pageNum, total, "");
  if (rows.length === 0) {
    listEl.innerHTML =
      '<p class="field-hint">아직 질문이 없습니다. 상단 <strong>글쓰기</strong>에서 첫 질문을 남겨 보세요.</p>';
    if (nav) nav.hidden = true;
    syncSearchChrome();
    return;
  }
  var html = '<ul class="doc-list" style="margin:0; list-style:none; padding:0">';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var nick = r.author_nickname ? escapeHtml(r.author_nickname) : "익명";
    var link = listDetailHref(pageNum, "", r.id);
    html +=
      '<li style="margin:0.5rem 0; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface2)">' +
      '<a href="' +
      link +
      '" style="font-weight:700; text-decoration:none; color:var(--text)">' +
      escapeHtml(r.title) +
      "</a><br />" +
      '<span class="field-hint" style="font-size:0.75rem">' +
      nick +
      " · " +
      fmtDate(r.created_at) +
      "</span></li>";
  }
  html += "</ul>";
  listEl.innerHTML = html;
  syncSearchChrome();
}

async function loadDetail(id) {
  var c = getClient();
  if (!c) return;
  var notFound = el("qa-not-found");
  var article = el("qa-detail-article");
  var qres = await c
    .from("qa_questions")
    .select("id,title,body,author_nickname,created_at")
    .eq("id", id)
    .maybeSingle();
  if (qres.error || !qres.data) {
    if (notFound) {
      notFound.style.display = "block";
    }
    if (article) {
      article.style.display = "none";
    }
    if (el("qa-question-delete-wrap")) el("qa-question-delete-wrap").setAttribute("hidden", "hidden");
    var back0 = buildBackToListHref();
    if (el("qa-back-to-list")) el("qa-back-to-list").href = back0;
    if (el("qa-not-found-list")) el("qa-not-found-list").href = back0;
    return;
  }
  if (notFound) {
    notFound.style.display = "none";
  }
  if (article) {
    article.style.display = "block";
  }
  var q = qres.data;
  if (el("qa-view-question-id")) {
    el("qa-view-question-id").value = id;
  }
  var canDelQ = !!getQuestionDeleteSecret(id);
  var wrap = el("qa-question-delete-wrap");
  if (wrap) {
    if (canDelQ) {
      wrap.removeAttribute("hidden");
    } else {
      wrap.setAttribute("hidden", "hidden");
    }
  }
  var delBtn = el("qa-q-delete");
  if (delBtn) {
    delBtn.onclick = function () {
      onDeleteQuestion(id);
    };
  }
  var titleEl = el("qa-detail-title");
  var metaEl = el("qa-detail-meta");
  var bodyEl = el("qa-detail-body");
  var answersEl = el("qa-answers");
  if (titleEl) titleEl.textContent = q.title;
  if (metaEl) metaEl.textContent = (q.author_nickname || "익명") + " · " + fmtDate(q.created_at);
  if (bodyEl) bodyEl.innerHTML = nl2br(q.body);

  var ares = await c
    .from("qa_answers")
    .select("id,question_id,body,author_nickname,created_at")
    .eq("question_id", id)
    .order("created_at", { ascending: true });
  if (answersEl) {
    if (ares.error) {
      answersEl.innerHTML = '<p class="field-hint">답변을 불러오지 못했습니다.</p>';
    } else {
      var ans = ares.data || [];
      if (ans.length === 0) {
        answersEl.innerHTML = '<p class="field-hint">아직 답변이 없습니다.</p>';
      } else {
        var h = "";
        for (var j = 0; j < ans.length; j++) {
          var a = ans[j];
          var canDelA = !!getAnswerDeleteSecret(a.id);
          h +=
            '<div style="margin-top:0.75rem; padding:0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface)">' +
            '<div class="qa-answer-hdr">' +
            "<span class=\"field-hint\" style=\"font-size:0.75rem;\">" +
            escapeHtml(a.author_nickname || "익명") +
            " · " +
            fmtDate(a.created_at) +
            "</span>" +
            (canDelA
              ? '<button type="button" class="qa-answer-del" data-aid="' +
                escapeHtml(a.id) +
                '">답글 삭제</button>'
              : "") +
            "</div>" +
            '<div style="line-height:1.55; font-size:0.9rem">' +
            nl2br(a.body) +
            "</div></div>";
        }
        answersEl.innerHTML = h;
      }
    }
  }
  if (el("qa-answer-question-id")) {
    el("qa-answer-question-id").value = id;
  }
  var backHref = buildBackToListHref();
  if (el("qa-back-to-list")) el("qa-back-to-list").href = backHref;
  if (el("qa-not-found-list")) el("qa-not-found-list").href = backHref;
}

async function onDeleteQuestion(questionId) {
  if (!window.confirm("이 질문과 달린 답글을 모두 삭제할까요?")) return;
  var c = getClient();
  if (!c) return;
  var sec = getQuestionDeleteSecret(questionId);
  if (!sec) {
    alert("이 브라우저에 삭제 권한이 없습니다. 글을 등록할 때 사용한 기기·브라우저에서 시도하세요.");
    return;
  }
  var res = await c.rpc("qa_delete_question", { p_question_id: questionId, p_secret: sec });
  if (res.error) {
    alert("삭제에 실패했습니다. " + res.error.message);
    return;
  }
  if (!res.data) {
    alert("삭제할 수 없습니다. (권한을 확인하세요.)");
    return;
  }
  clearQuestionDeleteSecret(questionId);
  window.location.href = buildBackToListHref();
}

async function onDeleteAnswer(answerId) {
  if (!window.confirm("이 답글을 삭제할까요?")) return;
  var c = getClient();
  if (!c) return;
  var qid = getQueryId() || (el("qa-answer-question-id") && el("qa-answer-question-id").value);
  var sec = getAnswerDeleteSecret(answerId);
  if (!sec) {
    alert("이 브라우저에 삭제 권한이 없습니다. 답글을 등록할 때 사용한 기기·브라우저에서 시도하세요.");
    return;
  }
  var res = await c.rpc("qa_delete_answer", { p_answer_id: answerId, p_secret: sec });
  if (res.error) {
    alert("삭제에 실패했습니다. " + res.error.message);
    return;
  }
  if (!res.data) {
    alert("삭제할 수 없습니다. (권한을 확인하세요.)");
    return;
  }
  clearAnswerDeleteSecret(answerId);
  if (qid) {
    loadDetail(qid);
  }
}

function getQueryId() {
  return new URLSearchParams(window.location.search).get("id");
}

function initLayout() {
  var id = getQueryId();
  var listSec = el("qa-section-list");
  var detailSec = el("qa-section-detail");
  if (id) {
    if (listSec) listSec.hidden = true;
    if (detailSec) detailSec.hidden = false;
    loadDetail(id);
  } else {
    if (listSec) listSec.hidden = false;
    if (detailSec) detailSec.hidden = true;
    loadList(getListPage());
  }
}

async function onSubmitAnswer(e) {
  e.preventDefault();
  var c = getClient();
  if (!c) return;
  var qid = (el("qa-answer-question-id") && el("qa-answer-question-id").value) || "";
  var body = (el("qa-a-body") && el("qa-a-body").value) || "";
  var nick = (el("qa-a-nick") && el("qa-a-nick").value) || "";
  body = body.trim();
  if (!qid || !body) {
    alert("답변 내용을 입력하세요.");
    return;
  }
  var btn = el("qa-a-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "등록 중…";
  }
  var authorSecret = newAuthorSecret();
  var res = await c
    .from("qa_answers")
    .insert([{ question_id: qid, body: body, author_nickname: nick || null, author_secret: authorSecret }])
    .select("id")
    .single();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "답변 등록";
  }
  if (res.error) {
    alert("답변 등록에 실패했습니다: " + res.error.message);
    return;
  }
  if (res.data && res.data.id) {
    setAnswerDeleteSecret(res.data.id, authorSecret);
  }
  if (el("qa-answer-form")) el("qa-answer-form").reset();
  if (el("qa-a-body")) el("qa-a-body").value = "";
  loadDetail(qid);
}

function boot() {
  if (!hasClient() || !getClient()) {
    showConfigMissing();
    return;
  }
  if (el("qa-unavailable-notice")) el("qa-unavailable-notice").hidden = true;
  if (el("qa-main")) el("qa-main").hidden = false;
  var sf = el("qa-search-form");
  if (sf) {
    sf.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (el("qa-search-input") && el("qa-search-input").value) || "";
      v = v.trim();
      if (!v) {
        window.location.href = "./";
        return;
      }
      window.location.href = listPageHref(1, v);
    });
  }
  syncSearchChrome();
  initLayout();
  var af = el("qa-answer-form");
  if (af) af.addEventListener("submit", onSubmitAnswer);
  var an = el("qa-answers");
  if (an) {
    an.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest(".qa-answer-del");
      if (!t) return;
      e.preventDefault();
      var aid = t.getAttribute("data-aid");
      if (aid) onDeleteAnswer(aid);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
