import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  newAuthorSecret,
  getThreadDeleteSecret,
  setReplyDeleteSecret,
  getReplyDeleteSecret,
  clearThreadDeleteSecret,
  clearReplyDeleteSecret,
  categoryLabel,
  DISCUSS_CATEGORY_SLUGS,
} from "../js/discuss-auth-storage.mjs";

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
  var n = el("disc-unavailable-notice");
  if (n) n.hidden = false;
  var main = el("disc-main");
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

function getCategoryFilter() {
  var raw = (new URLSearchParams(window.location.search).get("cat") || "").trim();
  if (DISCUSS_CATEGORY_SLUGS.indexOf(raw) >= 0) return raw;
  return "";
}

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

function listPageHref(pageNum, searchQ, catSlug) {
  var p = new URLSearchParams();
  var q = (searchQ != null && searchQ !== undefined ? String(searchQ) : getSearchQuery()).trim();
  if (q) p.set("q", q);
  var cat = catSlug != null && catSlug !== undefined ? String(catSlug).trim() : getCategoryFilter();
  if (cat && DISCUSS_CATEGORY_SLUGS.indexOf(cat) >= 0) p.set("cat", cat);
  if (pageNum > 1) p.set("page", String(pageNum));
  var s = p.toString();
  return s ? "?" + s : "./";
}

function buildBackToListHref() {
  var p = new URLSearchParams(window.location.search);
  p.delete("id");
  var s = p.toString();
  return s ? "?" + s : "./";
}

function listDetailHref(pageNum, searchQ, id) {
  var p = new URLSearchParams();
  var q = (searchQ != null && searchQ !== undefined ? String(searchQ) : getSearchQuery()).trim();
  if (q) p.set("q", q);
  if (pageNum > 1) p.set("page", String(pageNum));
  var cat = getCategoryFilter();
  if (cat) p.set("cat", cat);
  p.set("id", id);
  return "?" + p.toString();
}

function setSearchSummary(on, line) {
  var s = el("disc-search-summary");
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
  var inp = el("disc-search-input");
  if (inp) inp.value = qRaw;
  var reset = el("disc-search-reset");
  if (reset) {
    reset.hidden = !qRaw.trim();
    reset.href = listPageHref(1, "", getCategoryFilter());
  }
  var cat = getCategoryFilter();
  document.querySelectorAll("[data-disc-cat]").forEach(function (a) {
    var slug = a.getAttribute("data-disc-cat") || "";
    var active = (!cat && slug === "") || (cat && slug === cat);
    a.setAttribute("aria-current", active ? "true" : "false");
    a.classList.toggle("disc-cat-pill--active", active);
  });
}

function renderPagination(pageNum, total, listSearchQ) {
  var nav = el("disc-pagination");
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
  var cat = getCategoryFilter();
  var prevHref = listPageHref(prevN, sq, cat);
  var nextHref = listPageHref(nextN, sq, cat);
  var prevAttr = pageNum <= 1 ? ' aria-disabled="true" href="#"' : ' href="' + prevHref + '"';
  var nextAttr = pageNum >= totalPages ? ' aria-disabled="true" href="#"' : ' href="' + nextHref + '"';
  nav.innerHTML =
    '<a' +
    prevAttr +
    ">이전</a>" +
    '<span class="disc-pagination__info">' +
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

function threadQueryWithCat(base) {
  var cat = getCategoryFilter();
  if (!cat) return base;
  return base.eq("category", cat);
}

async function loadSearchList(pageNum, qRaw) {
  if (pageNum == null || !Number.isFinite(pageNum)) pageNum = 1;
  var c = getClient();
  var listEl = el("disc-list");
  var errEl = el("disc-list-error");
  if (!c || !listEl) return;
  var safe = sanitizeIlikeInput(qRaw);
  if (!safe) {
    window.location.replace("./");
    return;
  }
  var pat = "%" + safe + "%";
  listEl.innerHTML = '<p class="field-hint">검색 중…</p>';
  var nav = el("disc-pagination");
  if (nav) {
    nav.hidden = true;
    nav.innerHTML = "";
  }
  if (errEl) {
    errEl.textContent = "";
    errEl.hidden = true;
  }
  setSearchSummary(false, "");
  var cat = getCategoryFilter();

  var q1 = c.from("discuss_threads").select("id,title,category,author_nickname,created_at").ilike("title", pat);
  var q2 = c.from("discuss_threads").select("id,title,category,author_nickname,created_at").ilike("body", pat);
  if (cat) {
    q1 = q1.eq("category", cat);
    q2 = q2.eq("category", cat);
  }
  var t1 = await q1;
  var t2 = await q2;
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

  var qRep = c.from("discuss_replies").select("thread_id").ilike("body", pat).limit(3000);
  var tAns = await qRep;
  if (tAns.error) {
    if (errEl) {
      errEl.textContent = "댓글 검색에 실패했습니다. (" + tAns.error.message + ")";
      errEl.hidden = false;
    }
    listEl.innerHTML = "";
    return;
  }
  var need = [];
  var seenN = new Set();
  (tAns.data || []).forEach(function (a) {
    if (a && a.thread_id && !byId.has(a.thread_id) && !seenN.has(a.thread_id)) {
      seenN.add(a.thread_id);
      need.push(a.thread_id);
    }
  });
  for (var bi = 0; bi < need.length; bi += 100) {
    var batch = need.slice(bi, bi + 100);
    var q3 = c.from("discuss_threads").select("id,title,category,author_nickname,created_at").in("id", batch);
    if (cat) q3 = q3.eq("category", cat);
    var t3 = await q3;
    if (t3.error) {
      if (errEl) {
        errEl.textContent = "글 정보를 불러오지 못했습니다. (" + t3.error.message + ")";
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
    window.location.replace(listPageHref(totalPages, qRaw, cat));
    return;
  }
  setSearchSummary(true, "「" + (getSearchQuery() || qRaw) + "」 검색 · " + total + "건");
  var slice = rows.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  renderPagination(pageNum, total, qRaw);
  if (total === 0) {
    listEl.innerHTML =
      '<p class="field-hint">검색 조건에 맞는 글이 없습니다. 다른 키워드로 시도하거나 <a href="' +
      escapeHtml(listPageHref(1, "", cat)) +
      '">목록</a>을 보세요.</p>';
    if (nav) nav.hidden = true;
    syncSearchChrome();
    return;
  }
  var html = '<ul class="doc-list" style="margin:0; list-style:none; padding:0">';
  for (var i = 0; i < slice.length; i++) {
    var r = slice[i];
    var nick = r.author_nickname ? escapeHtml(r.author_nickname) : "익명";
    var link = listDetailHref(pageNum, qRaw, r.id);
    var lab = escapeHtml(categoryLabel(r.category));
    html +=
      '<li style="margin:0.5rem 0; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface2)">' +
      '<span class="field-hint" style="font-size:0.72rem; font-weight:700; color:var(--btn-primary-mid)">' +
      lab +
      "</span> " +
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
  var listEl = el("disc-list");
  var errEl = el("disc-list-error");
  if (!c || !listEl) return;
  listEl.innerHTML = '<p class="field-hint">불러오는 중…</p>';
  var nav = el("disc-pagination");
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
  var cat = getCategoryFilter();
  var res = await threadQueryWithCat(
    c.from("discuss_threads").select("id,title,category,author_nickname,created_at", { count: "exact" })
  )
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
    window.location.replace(listPageHref(totalPages, "", cat));
    return;
  }
  var rows = res.data || [];
  if (rows.length === 0 && total > 0 && pageNum > 1) {
    window.location.replace("./");
    return;
  }
  renderPagination(pageNum, total, "");
  if (rows.length === 0) {
    var hint =
      cat ?
        "이 카테고리에 아직 글이 없습니다. 상단 <strong>글쓰기</strong>에서 첫 글을 남겨 보세요." :
        "아직 글이 없습니다. 상단 <strong>글쓰기</strong>에서 첫 글을 남겨 보세요.";
    listEl.innerHTML = '<p class="field-hint">' + hint + "</p>";
    if (nav) nav.hidden = true;
    syncSearchChrome();
    return;
  }
  var html = '<ul class="doc-list" style="margin:0; list-style:none; padding:0">';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var nick = r.author_nickname ? escapeHtml(r.author_nickname) : "익명";
    var link = listDetailHref(pageNum, "", r.id);
    var lab = escapeHtml(categoryLabel(r.category));
    html +=
      '<li style="margin:0.5rem 0; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface2)">' +
      '<span class="field-hint" style="font-size:0.72rem; font-weight:700; color:var(--btn-primary-mid)">' +
      lab +
      "</span> " +
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
  var notFound = el("disc-not-found");
  var article = el("disc-detail-article");
  var qres = await c
    .from("discuss_threads")
    .select("id,title,body,category,author_nickname,created_at")
    .eq("id", id)
    .maybeSingle();
  if (qres.error || !qres.data) {
    if (notFound) {
      notFound.style.display = "block";
    }
    if (article) {
      article.style.display = "none";
    }
    if (el("disc-thread-delete-wrap")) el("disc-thread-delete-wrap").setAttribute("hidden", "hidden");
    var back0 = buildBackToListHref();
    if (el("disc-back-to-list")) el("disc-back-to-list").href = back0;
    if (el("disc-not-found-list")) el("disc-not-found-list").href = back0;
    return;
  }
  if (notFound) {
    notFound.style.display = "none";
  }
  if (article) {
    article.style.display = "block";
  }
  var q = qres.data;
  if (el("disc-view-thread-id")) {
    el("disc-view-thread-id").value = id;
  }
  var canDelQ = !!getThreadDeleteSecret(id);
  var wrap = el("disc-thread-delete-wrap");
  if (wrap) {
    if (canDelQ) {
      wrap.removeAttribute("hidden");
    } else {
      wrap.setAttribute("hidden", "hidden");
    }
  }
  var delBtn = el("disc-t-delete");
  if (delBtn) {
    delBtn.onclick = function () {
      onDeleteThread(id);
    };
  }
  var titleEl = el("disc-detail-title");
  var metaEl = el("disc-detail-meta");
  var bodyEl = el("disc-detail-body");
  var repliesEl = el("disc-replies");
  if (titleEl) titleEl.textContent = q.title;
  if (metaEl) {
    metaEl.textContent =
      "[" + categoryLabel(q.category) + "] " + (q.author_nickname || "익명") + " · " + fmtDate(q.created_at);
  }
  if (bodyEl) bodyEl.innerHTML = nl2br(q.body);

  var ares = await c
    .from("discuss_replies")
    .select("id,thread_id,body,author_nickname,created_at")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });
  if (repliesEl) {
    if (ares.error) {
      repliesEl.innerHTML = '<p class="field-hint">댓글을 불러오지 못했습니다.</p>';
    } else {
      var ans = ares.data || [];
      if (ans.length === 0) {
        repliesEl.innerHTML = '<p class="field-hint">아직 댓글이 없습니다.</p>';
      } else {
        var h = "";
        for (var j = 0; j < ans.length; j++) {
          var a = ans[j];
          var canDelA = !!getReplyDeleteSecret(a.id);
          h +=
            '<div style="margin-top:0.75rem; padding:0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface)">' +
            '<div class="disc-reply-hdr">' +
            "<span class=\"field-hint\" style=\"font-size:0.75rem;\">" +
            escapeHtml(a.author_nickname || "익명") +
            " · " +
            fmtDate(a.created_at) +
            "</span>" +
            (canDelA
              ? '<button type="button" class="disc-reply-del" data-rid="' +
                escapeHtml(a.id) +
                '">댓글 삭제</button>'
              : "") +
            "</div>" +
            '<div style="line-height:1.55; font-size:0.9rem">' +
            nl2br(a.body) +
            "</div></div>";
        }
        repliesEl.innerHTML = h;
      }
    }
  }
  if (el("disc-reply-thread-id")) {
    el("disc-reply-thread-id").value = id;
  }
  var backHref = buildBackToListHref();
  if (el("disc-back-to-list")) el("disc-back-to-list").href = backHref;
  if (el("disc-not-found-list")) el("disc-not-found-list").href = backHref;
}

async function onDeleteThread(threadId) {
  if (!window.confirm("이 글과 달린 댓글을 모두 삭제할까요?")) return;
  var c = getClient();
  if (!c) return;
  var sec = getThreadDeleteSecret(threadId);
  if (!sec) {
    alert("이 브라우저에 삭제 권한이 없습니다. 글을 등록할 때 사용한 기기·브라우저에서 시도하세요.");
    return;
  }
  var res = await c.rpc("discuss_delete_thread", { p_thread_id: threadId, p_secret: sec });
  if (res.error) {
    alert("삭제에 실패했습니다. " + res.error.message);
    return;
  }
  if (!res.data) {
    alert("삭제할 수 없습니다. (권한을 확인하세요.)");
    return;
  }
  clearThreadDeleteSecret(threadId);
  window.location.href = buildBackToListHref();
}

async function onDeleteReply(replyId) {
  if (!window.confirm("이 댓글을 삭제할까요?")) return;
  var c = getClient();
  if (!c) return;
  var tid = getQueryId() || (el("disc-reply-thread-id") && el("disc-reply-thread-id").value);
  var sec = getReplyDeleteSecret(replyId);
  if (!sec) {
    alert("이 브라우저에 삭제 권한이 없습니다. 댓글을 등록할 때 사용한 기기·브라우저에서 시도하세요.");
    return;
  }
  var res = await c.rpc("discuss_delete_reply", { p_reply_id: replyId, p_secret: sec });
  if (res.error) {
    alert("삭제에 실패했습니다. " + res.error.message);
    return;
  }
  if (!res.data) {
    alert("삭제할 수 없습니다. (권한을 확인하세요.)");
    return;
  }
  clearReplyDeleteSecret(replyId);
  if (tid) {
    loadDetail(tid);
  }
}

function getQueryId() {
  return new URLSearchParams(window.location.search).get("id");
}

function initLayout() {
  var id = getQueryId();
  var listSec = el("disc-section-list");
  var detailSec = el("disc-section-detail");
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

async function onSubmitReply(e) {
  e.preventDefault();
  var c = getClient();
  if (!c) return;
  var tid = (el("disc-reply-thread-id") && el("disc-reply-thread-id").value) || "";
  var body = (el("disc-r-body") && el("disc-r-body").value) || "";
  var nick = (el("disc-r-nick") && el("disc-r-nick").value) || "";
  body = body.trim();
  if (!tid || !body) {
    alert("댓글 내용을 입력하세요.");
    return;
  }
  var btn = el("disc-r-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "등록 중…";
  }
  var authorSecret = newAuthorSecret();
  var res = await c
    .from("discuss_replies")
    .insert([{ thread_id: tid, body: body, author_nickname: nick || null, author_secret: authorSecret }])
    .select("id")
    .single();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "댓글 등록";
  }
  if (res.error) {
    alert("댓글 등록에 실패했습니다: " + res.error.message);
    return;
  }
  if (res.data && res.data.id) {
    setReplyDeleteSecret(res.data.id, authorSecret);
  }
  if (el("disc-reply-form")) el("disc-reply-form").reset();
  if (el("disc-r-body")) el("disc-r-body").value = "";
  loadDetail(tid);
}

function boot() {
  if (!hasClient() || !getClient()) {
    showConfigMissing();
    return;
  }
  if (el("disc-unavailable-notice")) el("disc-unavailable-notice").hidden = true;
  if (el("disc-main")) el("disc-main").hidden = false;
  var sf = el("disc-search-form");
  if (sf) {
    sf.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = (el("disc-search-input") && el("disc-search-input").value) || "";
      v = v.trim();
      if (!v) {
        window.location.href = listPageHref(1, "", getCategoryFilter());
        return;
      }
      window.location.href = listPageHref(1, v, getCategoryFilter());
    });
  }
  syncSearchChrome();
  initLayout();
  var af = el("disc-reply-form");
  if (af) af.addEventListener("submit", onSubmitReply);
  var an = el("disc-replies");
  if (an) {
    an.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest(".disc-reply-del");
      if (!t) return;
      e.preventDefault();
      var rid = t.getAttribute("data-rid");
      if (rid) onDeleteReply(rid);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
