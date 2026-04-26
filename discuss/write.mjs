import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { newAuthorSecret, setThreadDeleteSecret, DISCUSS_CATEGORY_SLUGS } from "../js/discuss-auth-storage.mjs";

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

function boot() {
  if (!hasClient() || !getClient()) {
    if (el("disc-write-unavailable-notice")) el("disc-write-unavailable-notice").hidden = false;
    if (el("disc-write-main")) el("disc-write-main").hidden = true;
    return;
  }
  if (el("disc-write-unavailable-notice")) el("disc-write-unavailable-notice").hidden = true;
  if (el("disc-write-main")) el("disc-write-main").hidden = false;
  var qf = el("disc-post-form");
  if (qf) qf.addEventListener("submit", onSubmitPost);
}

async function onSubmitPost(e) {
  e.preventDefault();
  var c = getClient();
  if (!c) return;
  var category = (el("disc-p-category") && el("disc-p-category").value) || "";
  var title = (el("disc-p-title") && el("disc-p-title").value) || "";
  var body = (el("disc-p-body") && el("disc-p-body").value) || "";
  var nick = (el("disc-p-nick") && el("disc-p-nick").value) || "";
  category = category.trim();
  title = title.trim();
  body = body.trim();
  if (DISCUSS_CATEGORY_SLUGS.indexOf(category) < 0) {
    alert("카테고리를 선택하세요.");
    return;
  }
  if (!title || !body) {
    alert("제목과 내용을 입력하세요.");
    return;
  }
  var authorSecret = newAuthorSecret();
  var btn = el("disc-p-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "등록 중…";
  }
  var res = await c
    .from("discuss_threads")
    .insert([
      {
        category: category,
        title: title,
        body: body,
        author_nickname: nick || null,
        author_secret: authorSecret,
      },
    ])
    .select("id")
    .single();
  if (btn) {
    btn.disabled = false;
    btn.textContent = "글 등록";
  }
  if (res.error) {
    alert("등록에 실패했습니다: " + res.error.message);
    return;
  }
  setThreadDeleteSecret(res.data.id, authorSecret);
  window.location.href = "index.html?id=" + encodeURIComponent(res.data.id);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
