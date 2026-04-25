import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  var b = el("qa-config-banner");
  if (b) b.hidden = false;
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

async function loadList() {
  var c = getClient();
  var listEl = el("qa-list");
  var errEl = el("qa-list-error");
  if (!c || !listEl) return;
  listEl.innerHTML = '<p class="field-hint">불러오는 중…</p>';
  if (errEl) {
    errEl.textContent = "";
    errEl.hidden = true;
  }
  var res = await c
    .from("qa_questions")
    .select("id,title,author_nickname,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (res.error) {
    if (errEl) {
      errEl.textContent =
        "목록을 불러오지 못했습니다. 테이블·RLS·`js/supabase-config.js`를 확인하세요. (" +
        res.error.message +
        ")";
      errEl.hidden = false;
    }
    listEl.innerHTML = "";
    return;
  }
  var rows = res.data || [];
  if (rows.length === 0) {
    listEl.innerHTML = '<p class="field-hint">아직 질문이 없습니다. 아래에서 첫 질문을 남겨 보세요.</p>';
    return;
  }
  var html = '<ul class="doc-list" style="margin:0; list-style:none; padding:0">';
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var nick = r.author_nickname ? escapeHtml(r.author_nickname) : "익명";
    html +=
      '<li style="margin:0.5rem 0; padding:0.65rem 0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface2)">' +
      '<a href="?id=' +
      encodeURIComponent(r.id) +
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
}

async function loadDetail(id) {
  var c = getClient();
  if (!c) return;
  var notFound = el("qa-not-found");
  var article = el("qa-detail-article");
  var qres = await c.from("qa_questions").select("*").eq("id", id).maybeSingle();
  if (qres.error || !qres.data) {
    if (notFound) {
      notFound.style.display = "block";
    }
    if (article) {
      article.style.display = "none";
    }
    return;
  }
  if (notFound) {
    notFound.style.display = "none";
  }
  if (article) {
    article.style.display = "block";
  }
  var q = qres.data;
  var titleEl = el("qa-detail-title");
  var metaEl = el("qa-detail-meta");
  var bodyEl = el("qa-detail-body");
  var answersEl = el("qa-answers");
  if (titleEl) titleEl.textContent = q.title;
  if (metaEl) metaEl.textContent = (q.author_nickname || "익명") + " · " + fmtDate(q.created_at);
  if (bodyEl) bodyEl.innerHTML = nl2br(q.body);

  var ares = await c
    .from("qa_answers")
    .select("*")
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
          h +=
            '<div style="margin-top:0.75rem; padding:0.75rem; border:1px solid var(--border); border-radius:8px; background:var(--surface)">' +
            '<div class="field-hint" style="margin-bottom:0.35rem; font-size:0.75rem">' +
            escapeHtml(a.author_nickname || "익명") +
            " · " +
            fmtDate(a.created_at) +
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
}

function getQueryId() {
  return new URLSearchParams(window.location.search).get("id");
}

function initLayout() {
  var id = getQueryId();
  var listSec = el("qa-section-list");
  var formSec = el("qa-form-section");
  var detailSec = el("qa-section-detail");
  if (id) {
    if (listSec) listSec.hidden = true;
    if (formSec) formSec.hidden = true;
    if (detailSec) detailSec.hidden = false;
    loadDetail(id);
  } else {
    if (listSec) listSec.hidden = false;
    if (formSec) formSec.hidden = false;
    if (detailSec) detailSec.hidden = true;
    loadList();
  }
}

async function onSubmitQuestion(e) {
  e.preventDefault();
  var c = getClient();
  if (!c) return;
  var title = (el("qa-q-title") && el("qa-q-title").value) || "";
  var body = (el("qa-q-body") && el("qa-q-body").value) || "";
  var nick = (el("qa-q-nick") && el("qa-q-nick").value) || "";
  title = title.trim();
  body = body.trim();
  if (!title || !body) {
    alert("제목과 내용을 입력하세요.");
    return;
  }
  var btn = el("qa-q-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "등록 중…";
  }
  var res = await c
    .from("qa_questions")
    .insert([{ title: title, body: body, author_nickname: nick || null }])
    .select("id")
    .single();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "질문 등록";
  }
  if (res.error) {
    alert("등록에 실패했습니다: " + res.error.message);
    return;
  }
  if (el("qa-q-form")) el("qa-q-form").reset();
  window.location.href = "?id=" + encodeURIComponent(res.data.id);
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
  var res = await c
    .from("qa_answers")
    .insert([{ question_id: qid, body: body, author_nickname: nick || null }]);
  if (btn) {
    btn.disabled = false;
    btn.textContent = "답변 등록";
  }
  if (res.error) {
    alert("답변 등록에 실패했습니다: " + res.error.message);
    return;
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
  if (el("qa-config-banner")) el("qa-config-banner").hidden = true;
  if (el("qa-main")) el("qa-main").hidden = false;
  initLayout();
  var qf = el("qa-q-form");
  if (qf) qf.addEventListener("submit", onSubmitQuestion);
  var af = el("qa-answer-form");
  if (af) af.addEventListener("submit", onSubmitAnswer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
