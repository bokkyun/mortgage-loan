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

function boot() {
  if (!hasClient() || !getClient()) {
    if (el("qa-write-config-banner")) el("qa-write-config-banner").hidden = false;
    if (el("qa-write-main")) el("qa-write-main").hidden = true;
    return;
  }
  if (el("qa-write-config-banner")) el("qa-write-config-banner").hidden = true;
  if (el("qa-write-main")) el("qa-write-main").hidden = false;
  var qf = el("qa-q-form");
  if (qf) qf.addEventListener("submit", onSubmitQuestion);
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
  window.location.href = "index.html?id=" + encodeURIComponent(res.data.id);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
